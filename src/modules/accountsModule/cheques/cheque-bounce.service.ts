import { Injectable } from '@nestjs/common';
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { DEFAULT_ACTOR, throwAccountsBadRequest } from 'src/common/utils/module-service.utils';
import { BillType, DrCr, PdcPostingMode, PdcStatus } from '../receipt/types/receipt-enum';
import { accYearOf } from '../receipt/receipt.guards';
import {
  money,
  toAmount,
  toDateOnly,
  toDateString,
  todayUtc,
  ZERO,
} from '../receipt/receipt.utils';
import {
  assertDateOnOrAfter,
  assertNotInFuture,
  assertStatus,
  loadBankLedger,
  lockChequeOrThrow,
  resolveChequesInHand,
  type LockedCheque,
} from './cheques.guards';
import { logChequeStatus, reloadChequeRow } from './cheques.utils';
import { writeChequeVoucher, type ChequeLegSpec } from './cheque-voucher.helper';
import { cascadeAdvances, reverseChequeAdjustments } from './cheque-reversal.helper';
import {
  findSaleBillOfCheque,
  moveSaleBillHeader,
  moveSaleBillSettlement,
} from './sale-bill-cheque.helper';
import { ledgerForRole, requireChequeRoleLedgers } from './cheque-ledger-roles';
import {
  BOUNCE_CHARGE_SRC_DOC_TYPE,
  BOUNCE_VOUCHER_TYPE_CODE,
  BOUNCEABLE_STATUSES,
  ChequeLedgerRole,
} from './types/cheque-enum';
import { BounceChequeDto } from './dto/cheque-actions.dto';
import type {
  ChequeBillRef,
  ChequeBouncePayload,
  ChequeErrorDetail,
} from './types/cheque-api.types';

/**
 * §4.4 — THE transaction of this module.
 *
 * Nine ordered steps, one transaction, all or nothing. A bounce that
 * half-committed would leave an invoice reopened with no voucher behind it, or
 * a party charged for a bounce that the register does not record.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE FIVE LEGS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Under ON_RECEIPT, for a cheque of A with a party charge P and a bank
 * charge B:
 *
 *     DR  the party                     A + P
 *     CR  Cheques in Hand               A
 *     CR  BOUNCE_CHARGES_RECOVERED          P
 *     DR  BANK_CHARGES                          B
 *     CR  the bank                              B
 *
 * Debits and credits both come to A + P + B.
 *
 * ── Why the party is ONE leg and not two ─────────────────────────────────
 * The party is debited for two different reasons — the credit they were given
 * for the cheque is taken back, and they now owe us the bounce charge — and
 * they are the same ledger on the same side of the same voucher. §7's worked
 * example says five legs (19,050 / 19,050 on a cheque of 18,500 with P = 300
 * and B = 250), and one party leg of 18,800 is what makes it five. The two
 * reasons stay distinguishable anyway: the charge has its own CR leg, its own
 * role, and its own JOURNAL bill.
 *
 * ── Under ON_CLEARING, only the charges ──────────────────────────────────
 * Nothing was ever posted for the cheque, so there is no credit to take back
 * and no Cheques in Hand to relieve. Just DR party / CR recovered and
 * DR bank charges / CR bank — and with both charges zero, nothing at all,
 * which the service refuses rather than writing an empty voucher.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT IS DELIBERATELY NOT REFUSED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * §10: "no refusing a bounce because an advance was used — cascade (C4)."
 * The receipt's own `/cancel` refuses when its remainder has been spent, and
 * that is right there: cancelling is a choice. A bounce is not. The bank has
 * returned the cheque, the money is not ours, and a system that cannot record
 * that because of what the remainder was later spent on is not usable. So the
 * cascade unwinds the applications instead — see `cheque-reversal.helper`,
 * which also states the one case it will not guess at.
 */

const BOUNCE_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };

@Injectable()
export class ChequeBounceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async bounce(dto: BounceChequeDto): Promise<ChequeBouncePayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const bounceDate = toDateOnly(dto.bounceDate);
    const bankCharge = money(dto.bankCharge);
    const partyCharge = money(dto.partyCharge);

    return this.prisma.$transaction(async (tx) => {
      // ── 1 · Lock ────────────────────────────────────────────────────────
      // The register row first. The bills and the ADVANCE are locked by
      // `reverseChequeAdjustments` and `cascadeAdvances` as they read them —
      // ordered by id inside `lockBills`, which is what stops two bounces on
      // overlapping bills deadlocking.
      const cheque = await lockChequeOrThrow(tx, dto);
      assertStatus(cheque, BOUNCEABLE_STATUSES, 'bounced');

      assertNotInFuture(bounceDate, 'A bounce', 'bounceDate');
      assertDateOnOrAfter(
        bounceDate,
        cheque.apdDepositDate!,
        `Bounce ${cheque.apdInstrumentNo}`,
        'the day it was deposited',
        'bounceDate',
      );

      const reason = dto.reason.trim();
      if (!reason) {
        // ck_apd_bounced refuses a BOUNCED row with no reason, and this is that
        // rule said to the person who has to fix it.
        throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
          { field: 'reason', message: 'A bounce has to say why the bank sent it back' },
        ]);
      }

      const onReceipt = cheque.apdPostingMode !== PdcPostingMode.ON_CLEARING;
      if (!onReceipt && bankCharge.isZero() && partyCharge.isZero()) {
        // Nothing was posted when it arrived and nothing is being charged, so
        // there are no legs. Refused rather than written as an empty voucher:
        // ck_av_amount would refuse every leg anyway and the failure would
        // name a constraint instead of the situation.
        throwAccountsBadRequest<ChequeErrorDetail>('Nothing to post', [
          {
            field: 'apdId',
            message:
              `${cheque.apdInstrumentNo} was posted ON_CLEARING, so nothing stands behind it to ` +
              'reverse. With no charges on either side there is no voucher to write — record ' +
              'the bounce with a charge, or return the cheque instead.',
          },
        ]);
      }

      // ── 2 · Roles — by NAME, and only the ones actually needed ───────────
      const { bankChargeLedgerId, recoveredLedgerId } = await this.resolveRoles(tx, {
        cheque,
        bankCharge,
        partyCharge,
      });
      const inHand = onReceipt ? await resolveChequesInHand(tx, cheque) : null;
      const bank = bankCharge.greaterThan(0)
        ? await loadBankLedger(tx, cheque.apdCompanyId, cheque.apdBankLedgerId!, 'apdId')
        : null;

      const voucherAccYear = accYearOf(bounceDate);

      // ── 3 & 4 · The voucher, and its legs ───────────────────────────────
      const legs = this.buildLegs({
        cheque,
        onReceipt,
        inHandLedgerId: inHand?.ledgerId ?? null,
        bankLedgerId: bank?.ledgerId ?? null,
        bankChargeLedgerId,
        recoveredLedgerId,
        bankCharge,
        partyCharge,
      });

      const written = await writeChequeVoucher(tx, {
        typeCode: BOUNCE_VOUCHER_TYPE_CODE,
        field: 'apdId',
        companyId: cheque.apdCompanyId,
        branchId: cheque.apdBranchId,
        tenantId: cheque.apdTenantId,
        accYear: voucherAccYear,
        voucherDate: bounceDate,
        partyId: cheque.apdPartyId,
        employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
        docAmount: cheque.apdAmount,
        remarks:
          `Cheque ${cheque.apdInstrumentNo} returned — ${reason}` +
          (dto.reasonText ? ` (${dto.reasonText})` : ''),
        // The link back to the voucher this undoes. NOT avh_src_*: a cheque
        // may bounce, be re-presented and bounce again, and ux_avh_src would
        // refuse the second — which is a real event, not a duplicate.
        againstVoucherId: cheque.apdVoucherId,
        againstAccYear: cheque.apdVoucherAccYear,
        userId: actor,
        actor,
        legs,
      });

      const reversalScope = {
        voucherId: written.ref.voucherId,
        accYear: voucherAccYear,
        companyId: cheque.apdCompanyId,
        branchId: cheque.apdBranchId,
        tenantId: cheque.apdTenantId,
        userId: actor,
        sessionId: null,
        actor,
        reason: `Cheque ${cheque.apdInstrumentNo} bounced: ${reason}`,
      };

      // ── 5 · The cheque's own adjustment rows, reversed ──────────────────
      const reversed = await reverseChequeAdjustments(tx, cheque, reversalScope);

      // ── 6 · The C4 cascade ──────────────────────────────────────────────
      // Threaded row numbers: both sets land on the SAME voucher, and
      // restarting at 1 would give two rows the same abj_row_no.
      const cascade = await cascadeAdvances(tx, cheque, reversalScope, reversed.nextRowNo);

      // ── 7 · The party's charge becomes a bill they owe ──────────────────
      const chargeBill = await this.writeChargeBill(tx, {
        cheque,
        partyCharge,
        bounceDate,
        voucherId: written.ref.voucherId,
        voucherAccYear,
        voucherRefno: written.ref.voucherRefno,
        voucherTypeId: written.voucherTypeId,
        voucherNo: written.voucherNo,
        reason,
        actor,
      });

      const touched = [...reversed.bills, ...cascade.bills];
      const recomputed = await this.recompute.recomputeBills(tx, touched, todayUtc());

      // ── 6b · A cheque tendered ON a sale bill ───────────────────────────
      // Since notes (49) the bill writes an ALLOCATION row for its cheque, so
      // step 5 reversed it like any receipt's and the recompute reopened the
      // receivable; only the bill header's caches are moved here. A bill
      // posted before that (no row) is reopened through its tender as before.
      // Only ON_RECEIPT: under ON_CLEARING nothing was ever settled.
      const saleBill = onReceipt ? await findSaleBillOfCheque(tx, cheque) : null;
      let saleBillReopened: Awaited<ReturnType<typeof moveSaleBillSettlement>> | null = null;
      if (saleBill?.hasCounterRow) {
        const given = reversed.amountByBill.get(`${saleBill.ablId}|${saleBill.ablAccYear}`);
        if (given?.greaterThan(0)) {
          await moveSaleBillHeader(tx, saleBill, given.negated());
        }
      } else if (saleBill) {
        saleBillReopened = await moveSaleBillSettlement(
          tx,
          saleBill,
          cheque.apdAmount.negated(),
          bounceDate,
          actor,
        );
      }

      // ── 8 · The register, and the trail ─────────────────────────────────
      const now = new Date();
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
        data: {
          apdStatus: PdcStatus.BOUNCED,
          // ck_apd_bounced: a BOUNCED row must carry the date AND the reason.
          apdBounceDate: bounceDate,
          apdBounceReason: reason.slice(0, 150),
          apdBounceCharges: bankCharge.plus(partyCharge),
          apdBounceVoucherId: written.ref.voucherId,
          apdBounceAccYear: voucherAccYear,
          // The same voucher carries both: the charge legs and the reversal
          // are one event and splitting them across two vouchers would make
          // the day book show a bounce twice.
          apdChargeVoucherId: partyCharge.greaterThan(0) ? written.ref.voucherId : null,
          apdChargeAccYear: partyCharge.greaterThan(0) ? voucherAccYear : null,
          apdStatusOn: now,
          apdStatusBy: actor,
          apdModifiedOn: now,
          apdModifiedBy: actor,
        },
      });

      await logChequeStatus(tx, cheque, {
        fromStatus: cheque.apdStatus,
        toStatus: PdcStatus.BOUNCED,
        remarks:
          `${reason}${dto.reasonText ? ` — ${dto.reasonText}` : ''} — ` +
          `${written.ref.voucherRefno ?? ''}`,
        actor,
        changedOn: now,
      });

      // The trial check (notes 47), after every write: the party's bills = its
      // ledger (the bill this cheque paid is open again on both sides), and
      // Cheques In Hand = the register.
      await assertBooksReconcile(tx, {
        companyId: cheque.apdCompanyId,
        accYear: voucherAccYear,
        ledgerIds: [cheque.apdPartyId],
        cheques: [{ apdId: cheque.apdId, apdAccYear: cheque.apdAccYear }],
        vouchers: [{ voucherId: written.ref.voucherId, accYear: voucherAccYear }],
      });

      const pendingByBill = new Map(
        recomputed.map((bill) => [`${bill.billId}|${bill.accYear}`, bill]),
      );
      const docRefnos = await this.loadBillRefs(tx, touched);

      return {
        cheque: await reloadChequeRow(tx, cheque.apdId, cheque.apdAccYear),
        voucher: written.ref,
        legs: written.legs,
        billsReopened: recomputed
          .map((bill) => {
            const ref = docRefnos.get(`${bill.billId}|${bill.accYear}`);
            return {
              billId: bill.billId,
              billAccYear: bill.accYear,
              billType: ref?.billType ?? '',
              docRefno: ref?.docRefno ?? '',
              docDate: ref?.docDate ?? '',
              dueDate: ref?.dueDate ?? null,
              billAmount: toAmount(bill.billAmount),
              pendingAmount: toAmount(
                pendingByBill.get(`${bill.billId}|${bill.accYear}`)?.pendingAmount ?? ZERO,
              ),
              settledByThisCheque: toAmount(
                reversed.amountByBill.get(`${bill.billId}|${bill.accYear}`) ?? ZERO,
              ),
            };
          })
          .concat(saleBillReopened ? [saleBillReopened] : []),
        cascade: cascade.report,
        chargeBill,
        bankCharge: toAmount(bankCharge),
        partyCharge: toAmount(partyCharge),
      };
    }, BOUNCE_TRANSACTION_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 2 — the roles
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * §4.4 step 2, and §7's "bounce with `partyCharge` and no
   * `BOUNCE_CHARGES_RECOVERED` mapping → refused by role name, nothing
   * written".
   *
   * Resolved BEFORE the voucher is numbered, so the refusal costs nothing and
   * leaves nothing behind — not even a consumed number, which would show up as
   * a gap in the bounce series that nobody could explain.
   *
   * Only the roles actually needed. A shop that never charges its customers
   * for a bounce has no reason to have configured
   * `BOUNCE_CHARGES_RECOVERED`, and refusing their bounce over it would be
   * this module inventing a requirement.
   */
  private async resolveRoles(
    tx: Prisma.TransactionClient,
    params: {
      cheque: LockedCheque;
      bankCharge: Prisma.Decimal;
      partyCharge: Prisma.Decimal;
    },
  ): Promise<{ bankChargeLedgerId: string | null; recoveredLedgerId: string | null }> {
    const wanted: ChequeLedgerRole[] = [];
    if (params.bankCharge.greaterThan(0)) {
      wanted.push(ChequeLedgerRole.BANK_CHARGES);
    }
    if (params.partyCharge.greaterThan(0)) {
      wanted.push(ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED);
    }
    if (wanted.length === 0) {
      return { bankChargeLedgerId: null, recoveredLedgerId: null };
    }

    if (params.bankCharge.greaterThan(0) && !params.cheque.apdBankLedgerId) {
      throwAccountsBadRequest<ChequeErrorDetail>('Cheque has no deposit bank', [
        {
          field: 'bankCharge',
          message:
            `${params.cheque.apdInstrumentNo} names no bank ledger, so there is nowhere to ` +
            'credit the return fee the bank took. Record the bounce without a bank charge, or ' +
            're-deposit it first.',
        },
      ]);
    }

    const resolved = await requireChequeRoleLedgers(tx, wanted, {
      companyId: params.cheque.apdCompanyId,
      branchId: params.cheque.apdBranchId,
    });

    return {
      bankChargeLedgerId: ledgerForRole(resolved, ChequeLedgerRole.BANK_CHARGES)?.ledgerId ?? null,
      recoveredLedgerId:
        ledgerForRole(resolved, ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED)?.ledgerId ?? null,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 4 — the legs
  // ═════════════════════════════════════════════════════════════════════════

  /** The five (or two, or three) legs. See the header for the shape and the sum. */
  private buildLegs(params: {
    cheque: LockedCheque;
    onReceipt: boolean;
    inHandLedgerId: string | null;
    bankLedgerId: string | null;
    bankChargeLedgerId: string | null;
    recoveredLedgerId: string | null;
    bankCharge: Prisma.Decimal;
    partyCharge: Prisma.Decimal;
  }): ChequeLegSpec[] {
    const { cheque } = params;
    const legs: ChequeLegSpec[] = [];

    // ONE party leg, carrying both reasons. See the header note on why five.
    const partyDebit = (params.onReceipt ? cheque.apdAmount : ZERO).plus(params.partyCharge);
    if (partyDebit.greaterThan(0)) {
      legs.push({
        drCr: DrCr.DR,
        ledgerId: cheque.apdPartyId,
        amount: partyDebit,
        // The party is not a role (§2.6 of the receipt plan).
        role: null,
        remarks: params.onReceipt
          ? `Cheque ${cheque.apdInstrumentNo} returned` +
            (params.partyCharge.greaterThan(0) ? ' and bounce charge' : '')
          : `Bounce charge on cheque ${cheque.apdInstrumentNo}`,
      });
    }

    if (params.onReceipt && params.inHandLedgerId) {
      legs.push({
        drCr: DrCr.CR,
        ledgerId: params.inHandLedgerId,
        amount: cheque.apdAmount,
        remarks: `Cheque ${cheque.apdInstrumentNo} returned`,
      });
    }

    if (params.partyCharge.greaterThan(0) && params.recoveredLedgerId) {
      legs.push({
        drCr: DrCr.CR,
        ledgerId: params.recoveredLedgerId,
        amount: params.partyCharge,
        role: ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED,
        remarks: `Bounce charge recovered on ${cheque.apdInstrumentNo}`,
      });
    }

    if (params.bankCharge.greaterThan(0) && params.bankChargeLedgerId && params.bankLedgerId) {
      legs.push({
        drCr: DrCr.DR,
        ledgerId: params.bankChargeLedgerId,
        amount: params.bankCharge,
        role: ChequeLedgerRole.BANK_CHARGES,
        remarks: `Return charge on ${cheque.apdInstrumentNo}`,
      });
      legs.push({
        drCr: DrCr.CR,
        ledgerId: params.bankLedgerId,
        amount: params.bankCharge,
        remarks: `Return charge on ${cheque.apdInstrumentNo}`,
      });
    }

    return legs;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 7 — the charge bill
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * A JOURNAL bill for the party charge, DR — a real receivable they now owe.
   *
   * A bill and not just a ledger entry, for the reason the receipt's ADVANCE
   * gets one: a bill can be aged, chased, shown on the next receipt's open
   * items and allocated against. §7 requires exactly that — "the bounce-charge
   * bill is in the party's open items and may be allocated to" when the cheque
   * is re-presented.
   *
   * Skipped entirely when the charge is 0, because a bill of nothing is not a
   * debt (`ck_abl_amount` refuses it anyway).
   */
  private async writeChargeBill(
    tx: Prisma.TransactionClient,
    params: {
      cheque: LockedCheque;
      partyCharge: Prisma.Decimal;
      bounceDate: Date;
      voucherId: string;
      voucherAccYear: string;
      voucherRefno: string | null;
      voucherTypeId: number;
      voucherNo: bigint;
      reason: string;
      actor: string;
    },
  ): Promise<ChequeBillRef | null> {
    if (params.partyCharge.lessThanOrEqualTo(0)) {
      return null;
    }

    const bill = await tx.accBillBalance.create({
      data: {
        ablCompanyId: params.cheque.apdCompanyId,
        ablBranchId: params.cheque.apdBranchId,
        ablTenantId: params.cheque.apdTenantId,
        ablAccYear: params.voucherAccYear,
        ablPartyId: params.cheque.apdPartyId,
        ablSalesmanId: params.cheque.apdSalesmanId,
        ablBillType: BillType.JOURNAL,
        ablSrcModule: 'ACCOUNTS',
        ablSrcDocType: BOUNCE_CHARGE_SRC_DOC_TYPE,
        ablSrcDocId: params.cheque.apdId,
        ablSrcAccYear: params.cheque.apdAccYear,
        // ck_abl_voucher: a non-OPENING bill MUST name its voucher and type.
        ablVoucherId: params.voucherId,
        ablVoucherTypeId: params.voucherTypeId,
        ablVoucherNo: params.voucherNo,
        ablVoucherDate: params.bounceDate,
        ablVoucherRefno: params.voucherRefno,
        ablDocRefno: `BNC/${params.cheque.apdInstrumentNo}`,
        ablDocDate: params.bounceDate,
        // Due at once. A bounce charge has no credit period: it was incurred
        // by the party's own paper failing, and dating it forward would park
        // it outside the ageing that is the reason it is a bill.
        ablDueDate: params.bounceDate,
        // DR — what the party owes.
        ablDrCr: DrCr.DR,
        ablBillAmount: params.partyCharge,
        ablNarration: `Bounce charge on cheque ${params.cheque.apdInstrumentNo} — ${params.reason}`,
        ablCreatedBy: params.actor,
      },
      select: {
        ablId: true,
        ablAccYear: true,
        ablBillType: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablDueDate: true,
        ablBillAmount: true,
        ablPendingAmount: true,
      },
    });

    return {
      billId: bill.ablId,
      billAccYear: bill.ablAccYear,
      billType: bill.ablBillType,
      docRefno: bill.ablDocRefno,
      docDate: toDateString(bill.ablDocDate) ?? '',
      dueDate: toDateString(bill.ablDueDate),
      billAmount: toAmount(bill.ablBillAmount),
      pendingAmount: toAmount(bill.ablPendingAmount ?? bill.ablBillAmount),
      settledByThisCheque: 0,
    };
  }

  /** The printable face of the bills a reversal touched, for the response. */
  private async loadBillRefs(
    tx: Prisma.TransactionClient,
    bills: readonly { billId: string; accYear: string }[],
  ): Promise<
    Map<string, { billType: string; docRefno: string; docDate: string; dueDate: string | null }>
  > {
    if (bills.length === 0) {
      return new Map();
    }
    const rows = await tx.accBillBalance.findMany({
      where: {
        OR: bills.map((bill) => ({ ablId: bill.billId, ablAccYear: bill.accYear })),
      },
      select: {
        ablId: true,
        ablAccYear: true,
        ablBillType: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablDueDate: true,
      },
    });
    return new Map(
      rows.map((row) => [
        `${row.ablId}|${row.ablAccYear}`,
        {
          billType: row.ablBillType,
          docRefno: row.ablDocRefno,
          docDate: toDateString(row.ablDocDate) ?? '',
          dueDate: toDateString(row.ablDueDate),
        },
      ]),
    );
  }
}
