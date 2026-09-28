import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { loadRights, type MenuRights } from '../../../common/posting/rights';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { TxnStatusDocType, TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { lockCheques, chequeKey, type LockedCheque } from '../cheques/cheques.guards';
import { logChequeStatus } from '../cheques/cheques.utils';
import { writeChequeVoucher, type ChequeLegSpec } from '../cheques/cheque-voucher.helper';
import { allocationsReversedBy, reverseChequeAdjustments } from '../cheques/cheque-reversal.helper';
import { requireChequeRoleLedgers, ledgerForRole } from '../cheques/cheque-ledger-roles';
import { ChequeLedgerRole } from '../cheques/types/cheque-enum';
import { DrCr, PdcStatus } from '../receipt/types/receipt-enum';
import { accYearOfDate } from '../vouchers/voucher-derive';
import { assertVoucherBooksReconcile } from '../vouchers/voucher-books.helper';
import { VoucherRegisterService } from '../vouchers/voucher-register.service';
import { throwMissing, throwRight, throwState, VCH } from '../vouchers/vouchers.errors';
import type { PostVoucherDto } from '../vouchers/dto/voucher-payload.dto';
import type {
  IssuedChequeKeysDto,
  PresentedChequeDto,
  ReplaceChequeDto,
  ReverseChequeDto,
  VoidChequeDto,
} from './dto/issued-cheques.dto';
import type {
  IssuedChequeHistoryPayload,
  IssuedChequePayload,
  IssuedChequeReversal,
  ReplacedChequePayload,
} from './types/issued-cheques-api.types';

/** Menu 52 — Issued Cheques. Rights are read off it (the voucher's own type menu governs /vouchers/*). */
export const ISSUED_CHEQUES_MENU_ID = 52;

const TX = { maxWait: 15_000, timeout: 120_000 };
const ZERO = new Prisma.Decimal(0);

type Tx = Prisma.TransactionClient;

/** How a cheque's one line is taken back: the register status it lands in and the words it files. */
type Unwind = 'RETURNED' | 'STOPPED' | 'VOIDED' | 'REPLACED';

/**
 * notes (55) §4.10 — OUR cheques, handed to suppliers by a Payment Voucher
 * (`acc_pdc_register` rows with apd_tra_type 'P').
 *
 * An issued cheque was POSTED when it was written: DR supplier / CR the bank
 * it is drawn on. So nothing about its life moves money again except undoing
 * it:
 *
 *   presented  HELD → CLEARED    the bank paid it; no voucher (ck_apd_cleared
 *                                 was loosened for exactly this, P11b)
 *   returned   HELD → BOUNCED    our bank dishonoured it
 *   stop       HELD → CANCELLED  we told the bank not to pay it
 *   void       HELD → CANCELLED  it never left the office (spoilt, wrong)
 *   replace    HELD | BOUNCED | CANCELLED → REPLACED, and a NEW Payment
 *              Voucher with a new leaf pays the same bills
 *
 * returned / stop / void reverse the cheque's ONE LINE of the voucher — a
 * MANY Payment Voucher that paid three suppliers keeps the other two — with a
 * `ChqBnc` voucher against it: DR bank (the cheque) + DR TDS Payable (that
 * line's deduction, if any) / CR supplier (the gross the line discharged).
 * The line's bill allocations are reversed by `abj_cheque_id` (the same
 * reverser the received side uses), its TDS by a counter-row on the party's
 * `acc_tds_register` row. The leaf stays consumed: the book never gets it back.
 */
@Injectable()
export class IssuedChequesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly recompute: BillBalanceRecomputeService,
    private readonly register: VoucherRegisterService,
  ) {}

  private caller(): { userId: string | null; actor: string } {
    const userId = this.requestContext.getUserId() ?? null;
    return { userId, actor: userId ?? DEFAULT_ACTOR };
  }

  private async rights(tx: Tx, userId: string | null): Promise<MenuRights> {
    if (!userId) {
      throwRight('No user on the request', VCH.RIGHT_VIEW);
    }
    return loadRights(tx, userId, ISSUED_CHEQUES_MENU_ID);
  }

  private async requireRight(
    tx: Tx,
    userId: string | null,
    right: keyof MenuRights,
    code: string,
    verb: string,
  ): Promise<void> {
    const r = await this.rights(tx, userId);
    if (!r[right]) {
      throwRight(`This user may not ${verb} on Issued Cheques (menu 52)`, code);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  reads
  // ═════════════════════════════════════════════════════════════════════════

  async get(keys: IssuedChequeKeysDto): Promise<IssuedChequePayload> {
    const tx = this.prisma as unknown as Tx;
    await this.requireRight(tx, this.caller().userId, 'view', VCH.RIGHT_VIEW, 'view');
    return this.load(tx, keys);
  }

  async history(keys: IssuedChequeKeysDto): Promise<IssuedChequeHistoryPayload> {
    const tx = this.prisma as unknown as Tx;
    await this.requireRight(tx, this.caller().userId, 'view', VCH.RIGHT_VIEW, 'view');
    const cheque = await this.load(tx, keys);
    const entries = await this.prisma.txnStatusLog.findMany({
      where: {
        tslSrcDocType: TxnStatusDocType.CHEQUE_ISSUED,
        tslSrcDocId: cheque.apdId,
        tslAccYear: cheque.apdAccYear,
      },
      orderBy: { tslSeqNo: 'asc' },
      select: {
        tslSeqNo: true,
        tslEvent: true,
        tslFromStatus: true,
        tslToStatus: true,
        tslChangedOn: true,
        tslChangedBy: true,
        tslRemarks: true,
      },
    });
    return {
      apdId: cheque.apdId,
      apdAccYear: cheque.apdAccYear,
      leaf: cheque.leaf,
      // The issue itself is the register row; every later step is in the trail.
      issuedOn: cheque.issuedOn,
      issuedBy: cheque.createdBy,
      voucherRefno: cheque.voucherRefno,
      entries: entries.map((e) => ({
        seqNo: e.tslSeqNo,
        event: e.tslEvent,
        fromStatus: e.tslFromStatus,
        toStatus: e.tslToStatus,
        changedOn: e.tslChangedOn.toISOString(),
        changedBy: e.tslChangedBy,
        remarks: e.tslRemarks,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  presented — the bank paid it
  // ═════════════════════════════════════════════════════════════════════════

  async presented(dto: PresentedChequeDto): Promise<IssuedChequePayload> {
    const { userId, actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      await this.requireRight(tx, userId, 'post', VCH.RIGHT_POST, 'mark cheques presented');
      const cheque = await this.lock(tx, dto);
      this.assertHeld(cheque, 'presented');
      const day = isoDate(cheque.apdInstrumentDate);
      if (dto.date < day) {
        throwState(
          `Cheque ${cheque.apdInstrumentNo} is dated ${day}; the bank cannot have paid it on ${dto.date}`,
          VCH.CHEQUE_STATE,
          'date',
        );
      }
      const on = new Date(`${dto.date}T00:00:00Z`);
      const now = new Date();
      await tx.$executeRaw`
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'CLEARED', apd_status_on = ${now}, apd_status_by = ${actor},
               apd_deposit_date = ${on}::date, apd_clear_date = ${on}::date,
               apd_present_count = apd_present_count + 1,
               apd_remarks = COALESCE(${dto.remarks ?? null}, apd_remarks),
               apd_modified_on = ${now}, apd_modified_by = ${actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
      await logChequeStatus(tx, cheque, {
        fromStatus: PdcStatus.HELD,
        toStatus: PdcStatus.CLEARED,
        event: TxnStatusEvent.STATUS_CHANGED,
        remarks: `Presented and paid on ${dto.date}${dto.remarks ? ` — ${dto.remarks}` : ''}`,
        actor,
        changedOn: now,
      });
      return this.load(tx, dto);
    }, TX);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  returned / stop / void — the cheque's one line comes back out
  // ═════════════════════════════════════════════════════════════════════════

  async returned(dto: ReverseChequeDto): Promise<IssuedChequePayload> {
    return this.unwindRoute(dto, 'RETURNED', dto.date, dto.reason, dto.charges ?? 0);
  }

  async stop(dto: ReverseChequeDto): Promise<IssuedChequePayload> {
    return this.unwindRoute(dto, 'STOPPED', dto.date, dto.reason, dto.charges ?? 0);
  }

  async void(dto: VoidChequeDto): Promise<IssuedChequePayload> {
    return this.unwindRoute(dto, 'VOIDED', dto.date ?? todayIso(), dto.reason, 0);
  }

  private async unwindRoute(
    keys: IssuedChequeKeysDto,
    how: Unwind,
    date: string,
    reason: string,
    charges: number,
  ): Promise<IssuedChequePayload> {
    const { userId, actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      await this.requireRight(tx, userId, 'cancel', VCH.RIGHT_CANCEL, 'unwind cheques');
      const cheque = await this.lock(tx, keys);
      this.assertHeld(cheque, how.toLowerCase());
      await this.unwind(tx, cheque, { how, date, reason, charges, actor, userId });
      return this.load(tx, keys);
    }, TX);
  }

  /**
   * The one-line reversal. The caller holds the cheque's row lock and has
   * checked it is HELD.
   */
  private async unwind(
    tx: Tx,
    cheque: LockedCheque,
    o: {
      how: Unwind;
      date: string;
      reason: string;
      charges: number;
      actor: string;
      userId: string | null;
    },
  ): Promise<IssuedChequeReversal> {
    const bank = cheque.apdBankLedgerId;
    if (!bank || !cheque.apdVoucherId || !cheque.apdVoucherAccYear) {
      throwState(
        `Cheque ${cheque.apdInstrumentNo} names no bank or voucher — it did not come from a Payment Voucher`,
        VCH.CHEQUE_STATE,
      );
    }
    const accYear = accYearOfDate(o.date);
    const on = new Date(`${o.date}T00:00:00Z`);
    const now = new Date();

    // What the line discharged: the cheque's standing allocations. A line with
    // TDS deducted discharged the GROSS; the cheque carried the net, and the
    // difference is that line's deduction, which comes back too.
    const [standing] = await tx.$queryRaw<{ total: Prisma.Decimal | null }[]>`
      SELECT SUM(j.abj_amount) AS total
        FROM accounts.acc_bill_adjustment j
       WHERE j.abj_cheque_id = ${cheque.apdId}::uuid
         AND j.abj_cheque_acc_year = ${cheque.apdAccYear}::char(9)
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment r
                          WHERE r.abj_reversal_of_id = j.abj_id AND r.abj_is_deleted = false)`;
    const gross = new Prisma.Decimal(standing?.total ?? cheque.apdAmount);
    const lineTds = gross.greaterThan(cheque.apdAmount) ? gross.minus(cheque.apdAmount) : ZERO;

    // The voucher that deducted the TDS: today's voucher of the payment (a
    // post-dated cheque's own voucher answers it through avh_against_voucher_id).
    const [root] = await tx.$queryRaw<{ voucher_id: string; acc_year: string }[]>`
      SELECT COALESCE(h.avh_against_voucher_id, h.avh_voucher_id) AS voucher_id,
             COALESCE(h.avh_against_acc_year, h.avh_acc_year) AS acc_year
        FROM accounts.acc_voucher_header h
       WHERE h.avh_voucher_id = ${cheque.apdVoucherId}::uuid
         AND h.avh_acc_year = ${cheque.apdVoucherAccYear}::char(9)`;
    let tdsRow: { atd_id: string; atd_challan_no: string | null } | null = null;
    let tdsLedgerId: string | null = null;
    if (lineTds.greaterThan(0)) {
      [tdsRow] = await tx.$queryRaw<{ atd_id: string; atd_challan_no: string | null }[]>`
        SELECT t.atd_id, t.atd_challan_no FROM accounts.acc_tds_register t
         WHERE t.atd_voucher_id = ${root.voucher_id}::uuid
           AND t.atd_voucher_acc_year = ${root.acc_year}::char(9)
           AND t.atd_party_id = ${cheque.apdPartyId}::uuid
           AND t.atd_is_deleted = false AND t.atd_reversal_of_id IS NULL
         ORDER BY t.atd_created_on LIMIT 1`;
      if (tdsRow?.atd_challan_no) {
        throwState(
          `The TDS on cheque ${cheque.apdInstrumentNo} was deposited under challan ${tdsRow.atd_challan_no} — correct it with a 26Q revision first`,
          VCH.TDS_DEPOSITED,
        );
      }
      const [leg] = await tx.$queryRaw<{ av_ledger_id: string }[]>`
        SELECT v.av_ledger_id FROM accounts.acc_vouchers v
         WHERE v.av_voucher_id IN (${root.voucher_id}::uuid, ${cheque.apdVoucherId}::uuid)
           AND v.av_role = 'TDS_PAYABLE' AND v.av_is_deleted = false
         LIMIT 1`;
      tdsLedgerId = leg?.av_ledger_id ?? null;
      if (!tdsLedgerId) {
        throwState(
          `Cheque ${cheque.apdInstrumentNo}: its line had TDS deducted, but the payment carries no TDS Payable leg`,
          VCH.TDS_UNMAPPED,
        );
      }
    }

    const fee = new Prisma.Decimal(o.charges).toDecimalPlaces(2);
    let bankCharges: string | null = null;
    if (fee.greaterThan(0)) {
      const roles = await requireChequeRoleLedgers(tx, [ChequeLedgerRole.BANK_CHARGES], {
        companyId: cheque.apdCompanyId,
        branchId: cheque.apdBranchId,
      });
      bankCharges = ledgerForRole(roles, ChequeLedgerRole.BANK_CHARGES)?.ledgerId ?? null;
    }

    const label = {
      RETURNED: 'returned unpaid',
      STOPPED: 'stopped',
      VOIDED: 'voided',
      REPLACED: 'stopped for replacement',
    }[o.how];
    const legs: ChequeLegSpec[] = [
      {
        drCr: DrCr.DR,
        ledgerId: bank,
        amount: cheque.apdAmount,
        remarks: `Cheque ${cheque.apdInstrumentNo} ${label}`,
        reconDate: o.how === 'RETURNED' ? on : null,
      },
      ...(lineTds.greaterThan(0)
        ? [
            {
              drCr: DrCr.DR,
              ledgerId: tdsLedgerId!,
              amount: lineTds,
              role: 'TDS_PAYABLE',
              remarks: `TDS on cheque ${cheque.apdInstrumentNo} given back`,
            },
          ]
        : []),
      {
        drCr: DrCr.CR,
        ledgerId: cheque.apdPartyId,
        amount: gross,
        remarks: `Cheque ${cheque.apdInstrumentNo} ${label}: ${o.reason}`.slice(0, 250),
      },
      ...(bankCharges
        ? [
            {
              drCr: DrCr.DR,
              ledgerId: bankCharges,
              amount: fee,
              role: ChequeLedgerRole.BANK_CHARGES,
              remarks: `Bank charges on cheque ${cheque.apdInstrumentNo}`,
            },
            {
              drCr: DrCr.CR,
              ledgerId: bank,
              amount: fee,
              remarks: `Bank charges on cheque ${cheque.apdInstrumentNo}`,
            },
          ]
        : []),
    ];
    const voucher = await writeChequeVoucher(tx, {
      typeCode: 'ChqBnc',
      field: 'apdId',
      companyId: cheque.apdCompanyId,
      branchId: cheque.apdBranchId,
      tenantId: cheque.apdTenantId,
      accYear,
      voucherDate: on,
      partyId: cheque.apdPartyId,
      docAmount: cheque.apdAmount,
      remarks: `Issued cheque ${cheque.apdInstrumentNo} ${label}: ${o.reason}`.slice(0, 250),
      againstVoucherId: cheque.apdVoucherId,
      againstAccYear: cheque.apdVoucherAccYear,
      userId: o.userId ?? o.actor,
      actor: o.actor,
      legs,
    });

    const reversed = await reverseChequeAdjustments(tx, cheque, {
      voucherId: voucher.ref.voucherId,
      accYear: voucher.ref.accYear,
      companyId: cheque.apdCompanyId,
      branchId: cheque.apdBranchId,
      tenantId: cheque.apdTenantId,
      userId: o.userId ?? o.actor,
      sessionId: null,
      actor: o.actor,
      reason: `Cheque ${cheque.apdInstrumentNo} ${label}`,
    });
    if (reversed.bills.length > 0) {
      await this.recompute.recomputeBills(tx, reversed.bills, now);
    }

    if (tdsRow && lineTds.greaterThan(0)) {
      // The line's share of the party's deduction, given back (26Q reads the net).
      await tx.$executeRaw`
        INSERT INTO accounts.acc_tds_register (
          atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
          atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
          atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
          atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_reversal_of_id,
          atd_remarks, atd_created_by
        )
        SELECT o.atd_company_id, o.atd_branch_id, o.atd_tenant_id, o.atd_acc_year, o.atd_quarter, o.atd_direction,
               o.atd_party_id, o.atd_pan, o.atd_party_name, o.atd_deductee_type, o.atd_section, o.atd_rate,
               o.atd_rate_source, ${gross.toFixed(2)}::numeric, ${lineTds.negated().toFixed(2)}::numeric,
               ${voucher.ref.voucherId}::uuid, ${voucher.ref.accYear}::char(9),
               o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
               ${`Cheque ${cheque.apdInstrumentNo} ${label}: ${o.reason}`.slice(0, 250)}, ${o.actor}
          FROM accounts.acc_tds_register o WHERE o.atd_id = ${tdsRow.atd_id}::uuid`;
    }

    const to: PdcStatus =
      o.how === 'RETURNED'
        ? PdcStatus.BOUNCED
        : o.how === 'REPLACED'
          ? PdcStatus.REPLACED
          : PdcStatus.CANCELLED;
    const why = `${o.how}: ${o.reason}`.slice(0, 250);
    if (o.how === 'RETURNED') {
      await tx.$executeRaw`
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'BOUNCED', apd_status_on = ${now}, apd_status_by = ${o.actor},
               apd_deposit_date = COALESCE(apd_deposit_date, ${on}::date),
               apd_bounce_date = ${on}::date, apd_bounce_reason = ${o.reason.slice(0, 200)},
               apd_bounce_charges = ${fee.toFixed(2)}::numeric,
               apd_bounce_voucher_id = ${voucher.ref.voucherId}::uuid,
               apd_bounce_acc_year = ${voucher.ref.accYear}::char(9),
               apd_present_count = apd_present_count + 1,
               apd_modified_on = ${now}, apd_modified_by = ${o.actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
    } else if (o.how !== 'REPLACED') {
      // STOPPED / VOIDED: the reversal voucher is filed where a bounce's is.
      await tx.$executeRaw`
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'CANCELLED', apd_status_on = ${now}, apd_status_by = ${o.actor},
               apd_cancel_date = ${on}::date, apd_cancel_reason = ${why},
               apd_bounce_charges = ${fee.toFixed(2)}::numeric,
               apd_bounce_voucher_id = ${voucher.ref.voucherId}::uuid,
               apd_bounce_acc_year = ${voucher.ref.accYear}::char(9),
               apd_modified_on = ${now}, apd_modified_by = ${o.actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
    } else {
      // REPLACED is set by replace() once the new cheque exists (ck_apd_replaced).
      await tx.$executeRaw`
        UPDATE accounts.acc_pdc_register
           SET apd_cancel_date = ${on}::date, apd_cancel_reason = ${why},
               apd_bounce_voucher_id = ${voucher.ref.voucherId}::uuid,
               apd_bounce_acc_year = ${voucher.ref.accYear}::char(9),
               apd_modified_on = ${now}, apd_modified_by = ${o.actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
    }
    if (o.how !== 'REPLACED') {
      await logChequeStatus(tx, cheque, {
        fromStatus: PdcStatus.HELD,
        toStatus: to,
        event: TxnStatusEvent.CANCELLED,
        remarks: `${label} on ${o.date}: ${o.reason} — reversed by ${voucher.ref.voucherRefno ?? voucher.ref.voucherId}`,
        actor: o.actor,
        changedOn: now,
      });
    }

    await assertVoucherBooksReconcile(tx, {
      companyId: cheque.apdCompanyId,
      accYear: voucher.ref.accYear,
      ledgerIds: [cheque.apdPartyId, bank],
    });

    return {
      voucherId: voucher.ref.voucherId,
      accYear: voucher.ref.accYear,
      voucherRefno: voucher.ref.voucherRefno ?? null,
      gross: Number(gross.toFixed(2)),
      tds: Number(lineTds.toFixed(2)),
      charges: Number(fee.toFixed(2)),
      allocationsReversed: reversed.count,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  replace — a new leaf, a new Payment Voucher, the same bills
  // ═════════════════════════════════════════════════════════════════════════

  async replace(dto: ReplaceChequeDto): Promise<ReplacedChequePayload> {
    const { userId, actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      await this.requireRight(tx, userId, 'amend', VCH.RIGHT_AMEND, 'replace cheques');
      const cheque = await this.lock(tx, dto);
      const status = cheque.apdStatus;
      const replaceable = [PdcStatus.HELD, PdcStatus.BOUNCED, PdcStatus.CANCELLED];
      if (!replaceable.includes(status)) {
        throwState(
          `Cheque ${cheque.apdInstrumentNo} is ${status} — only an outstanding, returned, stopped or voided cheque is replaced`,
          VCH.CHEQUE_STATE,
        );
      }

      // Still out: stop it first (its line comes back out, the leaf stays spent).
      let reversal: { voucherId: string; accYear: string };
      if (status === PdcStatus.HELD) {
        const r = await this.unwind(tx, cheque, {
          how: 'REPLACED',
          date: dto.date,
          reason: dto.reason,
          charges: 0,
          actor,
          userId,
        });
        reversal = { voucherId: r.voucherId, accYear: r.accYear };
      } else if (cheque.apdBounceVoucherId && cheque.apdBounceAccYear) {
        reversal = {
          voucherId: cheque.apdBounceVoucherId,
          accYear: cheque.apdBounceAccYear.trim(),
        };
      } else {
        throwState(
          `Cheque ${cheque.apdInstrumentNo} was ${status} without a reversal voucher — nothing to pay again`,
          VCH.CHEQUE_STATE,
        );
      }

      // What the old cheque settled, bill by bill — to settle again. The TDS
      // tick follows the old line: a deduction was taken, so it is taken again.
      const restore = await allocationsReversedBy(tx, cheque, reversal);
      const gross = restore.reduce((s, a) => s.plus(a.amount), ZERO);
      const hadTds = gross.greaterThan(cheque.apdAmount);
      const [old] = await tx.$queryRaw<
        { td_tender_id: string | null; apd_favouring: string | null; apd_ac_payee: boolean }[]
      >`
        SELECT t.td_tender_id, p.apd_favouring, p.apd_ac_payee
          FROM accounts.acc_pdc_register p
          LEFT JOIN accounts.acc_tender_detail t ON t.td_id = p.apd_tender_id
         WHERE p.apd_id = ${cheque.apdId}::uuid AND p.apd_acc_year = ${cheque.apdAccYear}::char(9)`;
      if (!old?.td_tender_id) {
        throwState(
          `Cheque ${cheque.apdInstrumentNo} has no tender row to take the cheque tender from`,
          VCH.CHEQUE_STATE,
        );
      }
      const [book] = await tx.$queryRaw<{ acb_bank_ledger_id: string }[]>`
        SELECT acb_bank_ledger_id FROM accounts.acc_cheque_book WHERE acb_id = ${dto.chequeBookId}::uuid`;

      const payload: PostVoucherDto = {
        header: {
          companyId: cheque.apdCompanyId,
          branchId: cheque.apdBranchId,
          accYear: accYearOfDate(dto.date),
          typeCode: 'PmtV',
          date: dto.date,
          remarks: `Replaces cheque ${cheque.apdInstrumentNo}: ${dto.reason}`.slice(0, 250),
        },
        lines: [
          {
            rowNo: 1,
            drCr: 'DR',
            ledgerId: cheque.apdPartyId,
            amount: Number(cheque.apdAmount.toFixed(2)),
            tdsBase: hadTds,
            instrument: {
              tenderId: old.td_tender_id,
              bankLedgerId: dto.bankLedgerId ?? book?.acb_bank_ledger_id ?? cheque.apdBankLedgerId,
              chequeBookId: dto.chequeBookId,
              instrumentDate: dto.instrumentDate ?? dto.date,
              favouring: dto.favouring ?? old.apd_favouring,
              acPayee: dto.acPayee ?? old.apd_ac_payee,
            },
          },
        ],
        allocations: restore.map((a) => ({
          lineRowNo: 1,
          billId: a.billId,
          billAccYear: a.billAccYear,
          amount: Number(a.amount.toFixed(2)),
        })),
      } as unknown as PostVoucherDto;
      const posted = await this.register.postWithin(tx, payload);
      const ins = posted.instruments.find((i) => i.pdcId);
      if (!ins?.pdcId || !ins.pdcAccYear) {
        throw new Error(
          `replacement of ${cheque.apdInstrumentNo}: the new cheque was not registered`,
        );
      }

      const now = new Date();
      await tx.$executeRaw`
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'REPLACED', apd_status_on = ${now}, apd_status_by = ${actor},
               apd_replaced_by_id = ${ins.pdcId}::uuid,
               apd_replaced_by_acc_year = ${ins.pdcAccYear}::char(9),
               apd_cancel_date = COALESCE(apd_cancel_date, ${new Date(`${dto.date}T00:00:00Z`)}::date),
               apd_cancel_reason = COALESCE(apd_cancel_reason, ${`REPLACED: ${dto.reason}`.slice(0, 250)}),
               apd_modified_on = ${now}, apd_modified_by = ${actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
      await logChequeStatus(tx, cheque, {
        fromStatus: status,
        toStatus: PdcStatus.REPLACED,
        event: TxnStatusEvent.CANCELLED,
        remarks: `Replaced by cheque ${ins.refNo ?? ''} on ${posted.header.voucherRefno ?? ''}: ${dto.reason}`,
        actor,
        changedOn: now,
      });

      return {
        replaced: await this.load(tx, dto),
        replacement: await this.load(tx, {
          apdId: ins.pdcId,
          apdAccYear: ins.pdcAccYear,
          companyId: cheque.apdCompanyId,
          branchId: cheque.apdBranchId,
        }),
      };
    }, TX);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  shared
  // ═════════════════════════════════════════════════════════════════════════

  private async lock(tx: Tx, keys: IssuedChequeKeysDto): Promise<LockedCheque> {
    const got = await lockCheques(tx, [{ apdId: keys.apdId, apdAccYear: keys.apdAccYear }]);
    const cheque = got.get(chequeKey(keys.apdId, keys.apdAccYear));
    if (
      !cheque ||
      cheque.apdIsDeleted ||
      cheque.apdCompanyId !== keys.companyId ||
      cheque.apdBranchId !== keys.branchId ||
      cheque.apdTraType.trim() !== 'P'
    ) {
      throwMissing(
        `No issued cheque ${keys.apdId} in ${keys.apdAccYear} at this company / branch`,
        VCH.CHEQUE_NOT_FOUND,
        'apdId',
      );
    }
    return cheque;
  }

  private assertHeld(cheque: LockedCheque, action: string): void {
    if (cheque.apdStatus !== PdcStatus.HELD) {
      const next: Record<string, string> = {
        CLEARED: 'it was paid — nothing to undo',
        BOUNCED: 'replace it',
        CANCELLED: 'replace it',
        REPLACED: 'see its replacement',
      };
      throwState(
        `Cheque ${cheque.apdInstrumentNo} is ${cheque.apdStatus}; only an outstanding cheque can be ${action} — ${next[cheque.apdStatus] ?? 'nothing more to do'}`,
        VCH.CHEQUE_STATE,
      );
    }
  }

  private async load(tx: Tx, keys: IssuedChequeKeysDto): Promise<IssuedChequePayload> {
    const [r] = await tx.$queryRaw<IssuedRow[]>`
      SELECT p.apd_id, p.apd_acc_year, p.apd_company_id, p.apd_branch_id, p.apd_tra_type,
             p.apd_instrument_no, p.apd_instrument_date, p.apd_received_on, p.apd_amount,
             p.apd_party_id, s.led_name AS party_name, p.apd_favouring, p.apd_ac_payee,
             p.apd_bank_ledger_id, bk.led_name AS bank_name,
             p.apd_cheque_book_id, b.acb_book_no,
             p.apd_status, p.apd_status_on, p.apd_clear_date, p.apd_bounce_date, p.apd_bounce_reason,
             p.apd_bounce_charges, p.apd_cancel_date, p.apd_cancel_reason,
             p.apd_voucher_id, p.apd_voucher_acc_year, h.avh_voucher_refno, h.avh_voucher_date,
             vt.vchr_type_code, h.avh_against_voucher_id,
             p.apd_bounce_voucher_id, p.apd_bounce_acc_year, rv.avh_voucher_refno AS reversal_refno,
             p.apd_replaced_by_id, p.apd_replaced_by_acc_year, rp.apd_instrument_no AS replaced_by_leaf,
             (SELECT o.apd_id FROM accounts.acc_pdc_register o
               WHERE o.apd_replaced_by_id = p.apd_id AND o.apd_replaced_by_acc_year = p.apd_acc_year
               LIMIT 1) AS replaces_id,
             p.apd_print_count, p.apd_printed_on, p.apd_remarks, p.apd_created_by, p.apd_created_on
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_ledger_master s ON s.led_id = p.apd_party_id
        LEFT JOIN accounts.acc_ledger_master bk ON bk.led_id = p.apd_bank_ledger_id
        LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year
        LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_voucher_header rv
               ON rv.avh_voucher_id = p.apd_bounce_voucher_id AND rv.avh_acc_year = p.apd_bounce_acc_year
        LEFT JOIN accounts.acc_pdc_register rp
               ON rp.apd_id = p.apd_replaced_by_id AND rp.apd_acc_year = p.apd_replaced_by_acc_year
       WHERE p.apd_id = ${keys.apdId}::uuid AND p.apd_acc_year = ${keys.apdAccYear}::char(9)
         AND p.apd_company_id = ${keys.companyId}::uuid AND p.apd_branch_id = ${keys.branchId}::uuid
         AND p.apd_is_deleted = false`;
    if (!r || r.apd_tra_type.trim() !== 'P') {
      throwMissing(
        `No issued cheque ${keys.apdId} in ${keys.apdAccYear} at this company / branch`,
        VCH.CHEQUE_NOT_FOUND,
        'apdId',
      );
    }
    const n = (v: Prisma.Decimal | null) =>
      v === null ? null : Number(new Prisma.Decimal(v).toFixed(2));
    return {
      apdId: r.apd_id,
      apdAccYear: r.apd_acc_year.trim(),
      companyId: r.apd_company_id,
      branchId: r.apd_branch_id,
      leaf: r.apd_instrument_no,
      chequeDate: isoDate(r.apd_instrument_date),
      issuedOn: isoDate(r.apd_received_on),
      amount: n(r.apd_amount)!,
      partyId: r.apd_party_id,
      partyName: r.party_name,
      favouring: r.apd_favouring,
      acPayee: r.apd_ac_payee,
      bankLedgerId: r.apd_bank_ledger_id,
      bankName: r.bank_name,
      chequeBookId: r.apd_cheque_book_id,
      bookNo: r.acb_book_no,
      status: r.apd_status,
      isPostDated: r.apd_status === 'HELD' && isoDate(r.apd_instrument_date) > todayIso(),
      statusOn: r.apd_status_on?.toISOString() ?? null,
      presentedOn: r.apd_clear_date ? isoDate(r.apd_clear_date) : null,
      returnedOn: r.apd_bounce_date ? isoDate(r.apd_bounce_date) : null,
      returnReason: r.apd_bounce_reason,
      charges: n(r.apd_bounce_charges),
      cancelledOn: r.apd_cancel_date ? isoDate(r.apd_cancel_date) : null,
      cancelReason: r.apd_cancel_reason,
      voucherId: r.apd_voucher_id,
      voucherAccYear: r.apd_voucher_acc_year?.trim() ?? null,
      voucherRefno: r.avh_voucher_refno,
      voucherDate: r.avh_voucher_date ? isoDate(r.avh_voucher_date) : null,
      typeCode: r.vchr_type_code,
      paymentVoucherId: r.avh_against_voucher_id ?? r.apd_voucher_id,
      reversalVoucherId: r.apd_bounce_voucher_id,
      reversalAccYear: r.apd_bounce_acc_year?.trim() ?? null,
      reversalRefno: r.reversal_refno,
      replacedById: r.apd_replaced_by_id,
      replacedByAccYear: r.apd_replaced_by_acc_year?.trim() ?? null,
      replacedByLeaf: r.replaced_by_leaf,
      replacesId: r.replaces_id,
      printCount: r.apd_print_count,
      printedOn: r.apd_printed_on?.toISOString() ?? null,
      remarks: r.apd_remarks,
      createdBy: r.apd_created_by,
    };
  }
}

interface IssuedRow {
  apd_id: string;
  apd_acc_year: string;
  apd_company_id: string;
  apd_branch_id: string;
  apd_tra_type: string;
  apd_instrument_no: string;
  apd_instrument_date: Date;
  apd_received_on: Date;
  apd_amount: Prisma.Decimal;
  apd_party_id: string;
  party_name: string;
  apd_favouring: string | null;
  apd_ac_payee: boolean;
  apd_bank_ledger_id: string | null;
  bank_name: string | null;
  apd_cheque_book_id: string | null;
  acb_book_no: string | null;
  apd_status: string;
  apd_status_on: Date | null;
  apd_clear_date: Date | null;
  apd_bounce_date: Date | null;
  apd_bounce_reason: string | null;
  apd_bounce_charges: Prisma.Decimal | null;
  apd_cancel_date: Date | null;
  apd_cancel_reason: string | null;
  apd_voucher_id: string | null;
  apd_voucher_acc_year: string | null;
  avh_voucher_refno: string | null;
  avh_voucher_date: Date | null;
  vchr_type_code: string | null;
  avh_against_voucher_id: string | null;
  apd_bounce_voucher_id: string | null;
  apd_bounce_acc_year: string | null;
  reversal_refno: string | null;
  apd_replaced_by_id: string | null;
  apd_replaced_by_acc_year: string | null;
  replaced_by_leaf: string | null;
  replaces_id: string | null;
  apd_print_count: number;
  apd_printed_on: Date | null;
  apd_remarks: string | null;
  apd_created_by: string | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
