import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { VoucherPostingService } from 'src/common/posting/voucher-posting.service';
import { loadRights } from 'src/common/posting/rights';
import { TillEventService } from '../../till/services/till-event.service';
import { TillEventCode } from '../../till/types/till-enum';
import { assertAccYearWritable, assertVoucherPartitionExists } from '../receipt/receipt.guards';
import { accYearOfDate } from '../vouchers/voucher-derive';
import type { ResolveSettlementLineDto, WriteOffTenderDto } from './dto/tender-settlement.dto';
import { istDate } from './settlement-format';
import { throwSettlement } from './tender-settlement-errors';
import {
  TenderSettlementService,
  type SettlementCaller,
  type SettlementRow,
} from './tender-settlement.service';
import type {
  SettlementResolvePayload,
  WriteOffPayload,
} from './types/tender-settlement-api.types';
import {
  NONCASH_REASON_CATEGORY,
  RESOLVE_SRC_DOC_TYPE,
  SETTLEMENT_MENU_ID,
  SETTLEMENT_SRC_MODULE,
  SETTLEMENT_VOUCHER_TYPE_CODE,
  SettlementErrorCode,
  SettlementImportStatus,
  SettlementLineKind,
  SettlementMatchStatus,
  SettlementResolution,
  SettlementRole,
  WRITE_OFF_SRC_DOC_TYPE,
  WRITE_OFF_VOUCHER_TYPE_CODE,
  WriteOffTreatment,
} from './types/tender-settlement-enum';

type Tx = Prisma.TransactionClient;
const TX = { maxWait: 15_000, timeout: 60_000 };
const num = (d: Prisma.Decimal): number => Number(d.toFixed(2));

/**
 * Layer 4 (§6): the two exception lists decided.
 *
 *   resolve    a statement line no bill explains (§6.2) — LINKED to the bill's
 *              tender row found since, REFUNDED, INCOME or left in SUSPENSE
 *   write-off  a tender row the statement never paid, or a charged-back one
 *              (§6.1) — RECOVER, SUSPENSE or LOSS, posted as a TVar
 *
 * The plan puts both behind an approval (SETTLEMENT_RESOLVE, NONCASH_WRITE_OFF,
 * STORE_MANAGER). Until phase 3 builds the gate, OVERRIDE on menu 278 stands in
 * (user's call, 2026-10-08): the route is the manager's, and what the approval
 * would have asked is on the record (the event / the answer).
 */
@Injectable()
export class TenderSettlementExceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly posting: VoucherPostingService,
    private readonly events: TillEventService,
    private readonly settlement: TenderSettlementService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §6.2 — money, no row
  // ═════════════════════════════════════════════════════════════════════════

  async resolve(dto: ResolveSettlementLineDto): Promise<SettlementResolvePayload> {
    await this.requireOverride(
      SettlementErrorCode.RESOLVE_NEEDS_APPROVAL,
      'resolve a statement line',
    );
    const caller = await this.settlement.caller();
    const result = await this.prisma.$transaction(async (tx) => {
      const { head, line } = await this.settlement.lockLine(tx, dto);
      if ((head.asiStatus as SettlementImportStatus) !== SettlementImportStatus.POSTED) {
        throwSettlement(
          SettlementErrorCode.STATE,
          `The payout is ${head.asiStatus}: before it is posted a line is simply matched (confirm with a tdId)`,
          'aslId',
        );
      }
      if (
        (line.aslKind as SettlementLineKind) !== SettlementLineKind.SALE ||
        (line.aslMatchStatus as SettlementMatchStatus) !== SettlementMatchStatus.UNMATCHED
      ) {
        throwSettlement(
          SettlementErrorCode.STATE,
          `Line ${line.aslRowNo} is a ${line.aslKind} line, ${line.aslMatchStatus}: only an unmatched SALE line waits in Tender suspense`,
          'aslId',
        );
      }
      await this.requireReason(tx, head.asiCompanyId, dto.reasonId);
      const gross = new Prisma.Decimal(line.aslGrossAmount);
      const suspense = await this.settlement.roleLedger(tx, SettlementRole.TENDER_SUSPENSE, head);
      const today = istDate(new Date());

      let row: SettlementRow | null = null;
      let creditLedger: string | null = null;
      if (dto.resolution === SettlementResolution.LINKED) {
        if (!dto.tdId || !dto.tdAccYear) {
          throwSettlement(
            SettlementErrorCode.TD_NOT_CANDIDATE,
            'LINKED names the bill’s tender row: send tdId and tdAccYear (re-tender the bill to this tender first if it was keyed as another)',
            'tdId',
          );
        }
        row = await this.settlement.candidateRow(tx, head, line, dto.tdId, dto.tdAccYear);
        await this.settlement.assertTdFree(tx, line, row.tdId, row.tdAccYear);
        creditLedger = row.ledgerId;
      } else if (dto.resolution === SettlementResolution.INCOME) {
        creditLedger = await this.incomeLedger(tx, head.asiCompanyId, dto.incomeLedgerId ?? null);
      }

      let voucher: { voucherId: string; voucherRefno: string | null; accYear: string } | null =
        null;
      if (creditLedger) {
        const accYear = accYearOfDate(today);
        await assertAccYearWritable(tx, head.asiCompanyId, accYear, 'accYear');
        await assertVoucherPartitionExists(tx, accYear, 'accYear');
        const posted = await this.posting.postLegs(tx, {
          header: {
            companyId: head.asiCompanyId,
            branchId: head.asiBranchId,
            tenantId: head.asiTenantId,
            accYear,
            voucherTypeId: await this.settlement.voucherTypeId(tx, SETTLEMENT_VOUCHER_TYPE_CODE),
            voucherDate: today,
            srcModule: SETTLEMENT_SRC_MODULE,
            srcDocType: RESOLVE_SRC_DOC_TYPE,
            srcDocId: line.aslId,
            docLabel: 'Settlement line resolved',
            docRefno: head.asiPayoutRef,
            docDate: today,
            docAmount: num(gross),
            partyId: null,
            userId: caller.userId,
            deviceId: this.requestContext.getDeviceId() ?? null,
            remarks: `${head.asiProvider} line ${line.aslRowNo} (${line.aslRefNo ?? 'no ref'}) ${dto.resolution}`,
            createdBy: caller.actorName,
          },
          legs: [
            {
              ledgerId: suspense,
              drCr: 'DR',
              amount: num(gross),
              roleTag: SettlementRole.TENDER_SUSPENSE,
              oppLedgerId: creditLedger,
            },
            { ledgerId: creditLedger, drCr: 'CR', amount: num(gross), oppLedgerId: suspense },
          ],
        });
        voucher = { voucherId: posted.voucherId, voucherRefno: posted.voucherRefno, accYear };
      }
      if (row && voucher) {
        const diff = gross.minus(row.amount);
        await tx.$executeRaw`
          UPDATE accounts.acc_tender_detail
             SET td_settle_status     = ${diff.isZero() ? 'SETTLED' : 'PARTIAL'},
                 td_settled_on        = ${head.asiPayoutDate}::date,
                 td_settle_amount     = ${gross}::numeric,
                 td_settle_ref_no     = ${(head.asiPayoutRef ?? head.asiFileName).slice(0, 60)},
                 td_settle_voucher_id = ${voucher.voucherId}::uuid,
                 td_modified_on       = now(),
                 td_modified_by       = ${caller.actorName}
           WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
      }
      const updated = await tx.accSettlementLine.update({
        where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
        data: {
          aslMatchStatus: SettlementMatchStatus.RESOLVED,
          aslMatchRule: null,
          aslResolution: dto.resolution,
          aslTdId: row?.tdId ?? null,
          aslTdAccYear: row?.tdAccYear ?? null,
          aslAmountDiff: row ? gross.minus(row.amount) : new Prisma.Decimal(0),
          aslReasonId: dto.reasonId,
          aslResolutionVoucherId: voucher?.voucherId ?? null,
          aslResolutionAccYear: voucher?.accYear ?? null,
          aslNotes: dto.notes ?? line.aslNotes,
          aslModifiedOn: new Date(),
        },
      });
      return { line: updated, voucher };
    }, TX);
    return {
      line: await this.settlement.linePayloadOf(this.prisma, result.line),
      voucherId: result.voucher?.voucherId ?? null,
      voucherRefno: result.voucher?.voucherRefno ?? null,
      legs: await this.settlement.legsOf(
        result.voucher?.voucherId ?? null,
        result.voucher?.accYear ?? null,
      ),
      approvalEvent: 'SETTLEMENT_RESOLVE',
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §6.1 — our row, no money
  // ═════════════════════════════════════════════════════════════════════════

  async writeOff(dto: WriteOffTenderDto): Promise<WriteOffPayload> {
    await this.requireOverride(
      SettlementErrorCode.WRITE_OFF_NEEDS_APPROVAL,
      'write off a card / UPI amount',
    );
    const caller = await this.settlement.caller();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT td_id FROM accounts.acc_tender_detail
         WHERE td_id = ${dto.tdId}::uuid AND td_acc_year = ${dto.tdAccYear}::char(9) FOR UPDATE`;
      const row = (
        await this.settlement.rowsOf(tx, [{ tdId: dto.tdId, tdAccYear: dto.tdAccYear }])
      ).get(dto.tdId);
      if (!row || row.companyId !== dto.companyId || row.branchId !== dto.branchId) {
        throwSettlement(
          SettlementErrorCode.NOT_FOUND,
          `No tender row ${dto.tdId} in this store`,
          'tdId',
        );
      }
      if (row.isDeleted || row.isVoided || row.drCr !== 'DR' || row.tenderTypeId === 1) {
        throwSettlement(
          SettlementErrorCode.STATE,
          'Only a live money-in card / UPI / wallet row is written off',
          'tdId',
        );
      }
      const scope = { asiCompanyId: row.companyId, asiBranchId: row.branchId };
      const suspense = await this.settlement.roleLedger(tx, SettlementRole.TENDER_SUSPENSE, scope);
      const chargeback = await this.chargebackOf(tx, row);
      const held = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n
          FROM accounts.acc_settlement_line l
          JOIN accounts.acc_settlement_import i ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
         WHERE l.asl_td_id = ${row.tdId}::uuid AND l.asl_td_acc_year = ${row.tdAccYear}::char(9)
           AND l.asl_kind = 'SALE' AND l.asl_match_status IN ('MATCHED','SUGGESTED')
           AND i.asi_status IN ('IMPORTED','MATCHED') AND i.asi_is_deleted = false`;
      if (held[0].n > 0) {
        throwSettlement(
          SettlementErrorCode.STATE,
          'A statement not yet posted already pays this row: post (or unlink) it first',
          'tdId',
        );
      }

      let amount: Prisma.Decimal;
      let creditLedger: string;
      if (row.settleStatus === 'PENDING' || row.settleStatus === 'PARTIAL') {
        amount =
          row.settleStatus === 'PARTIAL' && row.settleAmount
            ? row.amount.minus(row.settleAmount)
            : row.amount;
        if (!amount.greaterThan(0)) {
          throwSettlement(
            SettlementErrorCode.POSTED_LOCKED,
            'The provider paid this row in full (or more): nothing is missing',
            'tdId',
          );
        }
        creditLedger = (await this.settlement.parkedRows(tx, [row.tdId])).has(row.tdId)
          ? suspense
          : row.ledgerId;
      } else if (row.settleStatus === 'FAILED' && chargeback && !chargeback.writtenOff) {
        // The chargeback's TSet put it in Tender suspense.
        amount = chargeback.amount;
        creditLedger = suspense;
      } else if (row.settleStatus === 'SETTLED') {
        throwSettlement(
          SettlementErrorCode.POSTED_LOCKED,
          'A posted payout settled this row: nothing to write off',
          'tdId',
        );
      } else {
        throwSettlement(
          SettlementErrorCode.STATE,
          `The row is ${row.settleStatus}${row.settleStatus === 'FAILED' ? ' and already written off' : ''}: it waits for no statement`,
          'tdId',
        );
      }
      await this.requireReason(tx, dto.companyId, dto.reasonId);
      const debitLedger =
        dto.treatment === WriteOffTreatment.SUSPENSE
          ? suspense
          : dto.treatment === WriteOffTreatment.LOSS
            ? await this.settlement.roleLedger(tx, SettlementRole.WRITE_OFF, scope)
            : await this.recoveryLedger(tx, dto.companyId, dto.recoveryLedgerId ?? null);

      const today = istDate(new Date());
      const accYear = accYearOfDate(today);
      let voucher: { voucherId: string; voucherRefno: string | null } | null = null;
      if (debitLedger !== creditLedger) {
        await assertAccYearWritable(tx, dto.companyId, accYear, 'accYear');
        await assertVoucherPartitionExists(tx, accYear, 'accYear');
        const session = await this.realSession(tx, row.sessionId);
        voucher = await this.posting.postLegs(tx, {
          header: {
            companyId: row.companyId,
            branchId: row.branchId,
            accYear,
            voucherTypeId: await this.settlement.voucherTypeId(tx, WRITE_OFF_VOUCHER_TYPE_CODE),
            voucherDate: today,
            srcModule: SETTLEMENT_SRC_MODULE,
            srcDocType: WRITE_OFF_SRC_DOC_TYPE,
            srcDocId: row.tdId,
            docLabel: 'Non-cash write-off',
            docAmount: num(amount),
            partyId: null,
            userId: caller.userId,
            sessionId: session?.tssId ?? null,
            deviceId: this.requestContext.getDeviceId() ?? null,
            remarks: `${chargeback ? 'Chargeback' : 'Not received'} ${num(amount).toFixed(2)} (${dto.treatment})`,
            createdBy: caller.actorName,
          },
          legs: [
            { ledgerId: debitLedger, drCr: 'DR', amount: num(amount), oppLedgerId: creditLedger },
            { ledgerId: creditLedger, drCr: 'CR', amount: num(amount), oppLedgerId: debitLedger },
          ],
        });
      }
      await tx.$executeRaw`
        UPDATE accounts.acc_tender_detail
           SET td_settle_status     = 'FAILED',
               td_settle_voucher_id = COALESCE(${voucher?.voucherId ?? null}::uuid, td_settle_voucher_id),
               td_modified_on       = now(),
               td_modified_by       = ${caller.actorName}
         WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
      const session = await this.realSession(tx, row.sessionId);
      await this.events.log(tx, {
        companyId: row.companyId,
        branchId: row.branchId,
        // On the row's own session (its History), in that session's year.
        accYear: session?.tssAccYear ?? accYear,
        code: TillEventCode.NONCASH_WRITTEN_OFF,
        sessionId: session?.tssId ?? null,
        dayId: session?.tssDayId ?? null,
        counterId: session?.tssCounterId ?? null,
        deviceId: this.requestContext.getDeviceId() ?? null,
        userId: caller.userId,
        srcDocType: row.srcDocType,
        srcDocId: row.srcDocId,
        srcRefno: voucher?.voucherRefno ?? null,
        amount,
        reasonId: dto.reasonId,
        payload: {
          tdId: row.tdId,
          treatment: dto.treatment,
          chargeback: !!chargeback,
          debitLedgerId: debitLedger,
          creditLedgerId: creditLedger,
          voucherId: voucher?.voucherId ?? null,
          approval: { event: 'NONCASH_WRITE_OFF', standIn: 'menu 278 OVERRIDE', by: caller.userId },
          notes: dto.notes ?? null,
        },
      });
      return {
        tdId: row.tdId,
        tdAccYear: row.tdAccYear,
        treatment: dto.treatment,
        amount: num(amount),
        debitLedgerId: debitLedger,
        creditLedgerId: creditLedger,
        voucherId: voucher?.voucherId ?? null,
        voucherRefno: voucher?.voucherRefno ?? null,
        voucherAccYear: voucher ? accYear : null,
        sessionId: session?.tssId ?? null,
        approvalEvent: 'NONCASH_WRITE_OFF',
      } satisfies WriteOffPayload;
    }, TX);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Internals
  // ═════════════════════════════════════════════════════════════════════════

  /** The approval stand-in: menu 278 OVERRIDE, no SUPER ADMIN bypass. */
  private async requireOverride(code: SettlementErrorCode, action: string): Promise<void> {
    const userId = this.requestContext.getUserId();
    const rights = userId ? await loadRights(this.prisma, userId, SETTLEMENT_MENU_ID) : null;
    if (!rights?.override) {
      throwSettlement(
        code,
        `Only an approver may ${action}: OVERRIDE on Settlement Reconciliation (menu ${SETTLEMENT_MENU_ID}) stands in for the approval until the approval gate ships`,
        'userId',
        {
          event:
            code === SettlementErrorCode.WRITE_OFF_NEEDS_APPROVAL
              ? 'NONCASH_WRITE_OFF'
              : 'SETTLEMENT_RESOLVE',
          requiredRole: 'STORE_MANAGER',
        },
      );
    }
  }

  private async requireReason(tx: Tx, companyId: string, reasonId: string): Promise<void> {
    const reason = await tx.tillReason.findFirst({
      where: {
        trsId: reasonId,
        trsCategory: NONCASH_REASON_CATEGORY,
        trsIsActive: true,
        trsIsDeleted: false,
        OR: [{ trsCompanyId: null }, { trsCompanyId: companyId }],
      },
      select: { trsId: true },
    });
    if (!reason) {
      throwSettlement(
        SettlementErrorCode.REASON_INVALID,
        'Name a live NONCASH reason (Till Masters → reasons)',
        'reasonId',
      );
    }
  }

  /** The CHARGEBACK line of a posted payout that failed this row, and whether a write-off took it since. */
  private async chargebackOf(
    tx: Tx,
    row: SettlementRow,
  ): Promise<{ amount: Prisma.Decimal; writtenOff: boolean } | null> {
    const [hit] = await tx.$queryRaw<{ gross: Prisma.Decimal; written_off: boolean }[]>`
      SELECT l.asl_gross_amount AS gross,
             EXISTS (SELECT 1 FROM accounts.acc_voucher_header w
                      WHERE w.avh_voucher_id = ${row.settleVoucherId}::uuid
                        AND w.avh_src_doc_type = ${WRITE_OFF_SRC_DOC_TYPE}) AS written_off
        FROM accounts.acc_settlement_line l
        JOIN accounts.acc_settlement_import i ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
       WHERE l.asl_td_id = ${row.tdId}::uuid AND l.asl_td_acc_year = ${row.tdAccYear}::char(9)
         AND l.asl_kind = 'CHARGEBACK' AND l.asl_match_status = 'MATCHED'
         AND i.asi_status = 'POSTED' AND i.asi_is_deleted = false
       ORDER BY i.asi_posted_on DESC
       LIMIT 1`;
    return hit ? { amount: new Prisma.Decimal(hit.gross), writtenOff: hit.written_off } : null;
  }

  private async recoveryLedger(
    tx: Tx,
    companyId: string,
    ledgerId: string | null,
  ): Promise<string> {
    if (!ledgerId) {
      throwSettlement(
        SettlementErrorCode.LEDGER_INVALID,
        'RECOVER names the ledger the amount is recovered from (the cashier’s, say): send recoveryLedgerId',
        'recoveryLedgerId',
      );
    }
    const ledger = await tx.accLedgerMaster.findFirst({
      where: {
        ledId: ledgerId,
        ledIsDeleted: false,
        ledIsActive: true,
        OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
      },
      select: { ledId: true },
    });
    if (!ledger) {
      throwSettlement(
        SettlementErrorCode.LEDGER_INVALID,
        'The recovery ledger is not a live ledger of this company',
        'recoveryLedgerId',
      );
    }
    return ledger.ledId;
  }

  /** INCOME: a live ledger under an Income group (anywhere above it), the company's or shared. */
  private async incomeLedger(tx: Tx, companyId: string, ledgerId: string | null): Promise<string> {
    if (!ledgerId) {
      throwSettlement(
        SettlementErrorCode.LEDGER_INVALID,
        'INCOME names the income ledger the money is booked to: send incomeLedgerId',
        'incomeLedgerId',
      );
    }
    const [hit] = await tx.$queryRaw<{ ok: boolean }[]>`
      WITH RECURSIVE up AS (
        SELECT g.acc_group_id, g.acc_group_parent_id, g.acc_group_nature, 0 AS d
          FROM accounts.acc_ledger_master l
          JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
         WHERE l.led_id = ${ledgerId}::uuid AND l.led_is_deleted = false AND l.led_is_active
           AND (l.led_company_id IS NULL OR l.led_company_id = ${companyId}::uuid)
        UNION ALL
        SELECT p.acc_group_id, p.acc_group_parent_id, p.acc_group_nature, up.d + 1
          FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
         WHERE up.d < 24
      )
      SELECT bool_or(acc_group_nature = 'Income') AS ok FROM up`;
    if (!hit?.ok) {
      throwSettlement(
        SettlementErrorCode.LEDGER_INVALID,
        'The income ledger must be a live ledger of this company under an Income group',
        'incomeLedgerId',
      );
    }
    return ledgerId;
  }

  /** The row's session when it names a real till session (today's client sends a random uuid per run). */
  private async realSession(tx: Tx, sessionId: string | null) {
    if (!sessionId) return null;
    return tx.tillSession.findFirst({
      where: { tssId: sessionId, tssIsDeleted: false },
      select: { tssId: true, tssAccYear: true, tssDayId: true, tssCounterId: true },
    });
  }
}

export type { SettlementCaller };
