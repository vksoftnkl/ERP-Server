import { Injectable } from '@nestjs/common';
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { deriveVoucherTotals } from '../accountVoucherHeader/voucher-totals.helper';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import {
  DEFAULT_ACTOR,
  throwAccountsBadRequest,
  throwAccountsConflict,
} from 'src/common/utils/module-service.utils';
import { OpenItemsService, creditRouting } from './open-items.service';
import { ReceiptService, statusOf, type StoredHeader } from './receipt.service';
import { requireReceiptRoleLedgers, ledgerForRole } from './receipt-ledger-roles';
import { rehydrateDraft } from './receipt-draft-lines';
import {
  normaliseOtherLines,
  normaliseTenders,
  type NormalisedOtherLine,
  type NormalisedTender,
} from './receipt-lines';
import {
  accYearOf,
  assertAccYearWritable,
  assertBillUsable,
  assertHeaderScope,
  assertVoucherPartitionExists,
  lockBills,
  loadParty,
} from './receipt.guards';
import {
  allocate,
  AllocationError,
  pdcVoucherKey,
  RECEIPT_VOUCHER_KEY,
  type AllocationAdjustment,
  type AllocationBill,
  type AllocationCredit,
  type AllocationResult,
  type VoucherKey,
} from './allocation-engine';
import { money, sum, toAmount, toDateString, todayUtc, ZERO } from './receipt.utils';
import { PostReceiptDto } from './dto/post-receipt.dto';
import {
  ADVANCE_SRC_DOC_TYPE,
  BillType,
  DrCr,
  PdcInstrumentType,
  PdcPostingMode,
  PdcStatus,
  PdcTraType,
  RECEIPT_SRC_MODULE,
  ReceiptLedgerRole,
  VoucherStatus,
} from './types/receipt-enum';
import type { ReceiptErrorDetail, ReceiptPostPayload } from './types/receipt-api.types';

/**
 * §5.2 — THE transaction.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ORDER, AND WHY IT IS THE ORDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1  lock the receipt, and refuse a status that may not post
 *   2  re-validate everything §5.1 validated on the draft
 *   3  lock every bill and credit named, and read what is pending NOW
 *   4  the identity, to the paisa                     ─┐ inside the engine,
 *   5  the allocation engine                          ─┘ which is pure
 *   6  the PDC register rows
 *   7  the numbers
 *   8  the PDC voucher headers, as DRAFT
 *   9  the legs
 *  10  the adjustment rows
 *  11  the ADVANCE bills
 *  12  the tender rows point at their voucher
 *  13  the register rows point at their voucher
 *  14  the bill caches are recomputed
 *  15  the headers become POSTED — LAST
 *
 * Step 15 is last because `ck_avh_balanced` fires on the transition to POSTED
 * and compares `avh_total_debit` with `avh_total_credit`, which the totals
 * helper has just derived from the legs written in step 9. Set POSTED before
 * the legs exist and the constraint compares 0 with 0 and passes — the vacuous
 * pass the plan's notes (4) reported. The ORDER is the check.
 *
 * Steps 6–8 sit where they do because each needs the one before: an adjustment
 * naming a cheque needs `ck_abj_cheque_mode`'s register row to exist, a leg
 * needs its voucher's NUMBER (`av_voucher_no` is NOT NULL), and a voucher
 * cannot be numbered before it is known to be needed.
 *
 * A failure anywhere rolls the whole thing back, numbers included — which is
 * why the allocator stays INSIDE the transaction. Its advisory locks are held
 * for the life of the transaction, so a rollback returns the numbers and the
 * series has no gap.
 */

const POST_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };

/** One voucher being built, before it exists. */
interface PlannedVoucher {
  key: VoucherKey;
  /** Null for the receipt itself, which already exists as a DRAFT. */
  tenderRowNo: number | null;
  voucherDate: Date;
  accYear: string;
  docAmount: Prisma.Decimal;
  /** Filled once the header is created / found. */
  voucherId: string;
  voucherNo: bigint;
  voucherRefno: string;
}

@Injectable()
export class ReceiptPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly receiptService: ReceiptService,
    private readonly openItemsService: OpenItemsService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async post(dto: PostReceiptDto): Promise<ReceiptPostPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;

    try {
      return await this.prisma.$transaction(
        (tx) => this.postInTransaction(tx, dto, actor),
        POST_TRANSACTION_OPTIONS,
      );
    } catch (error) {
      throw rethrowAllocationError(error);
    }
  }

  /**
   * The fifteen steps, inside a transaction the CALLER owns.
   *
   * Public because `/receipts/amend` re-applies a posted receipt from a new
   * payload and must do it in the same transaction as the unwind that made
   * room for it (R20 §2 step 4). It calls this rather than reproducing the
   * steps, which is the whole reason amend is safe to have: there is one
   * definition of what posting a receipt means, and an amended receipt is
   * posted by it.
   *
   * The caller is responsible for `rethrowAllocationError`, and for the
   * header being a DRAFT by the time it gets here — `assertStatusMayPost` is
   * not relaxed for amend, because by then the unwind genuinely has put the
   * header back to DRAFT.
   */
  async postInTransaction(
    tx: Prisma.TransactionClient,
    dto: PostReceiptDto,
    actor: string,
  ): Promise<ReceiptPostPayload> {
    // ── 1 · The receipt, locked ────────────────────────────────────────────
    await this.lockHeader(tx, dto.avhVoucherId, dto.avhAccYear);
    const header = await this.receiptService.loadHeaderOrThrow(
      tx,
      dto.avhVoucherId,
      dto.avhAccYear,
    );
    assertHeaderScope(header, {
      companyId: dto.avhCompanyId,
      branchId: dto.avhBranchId,
      accYear: dto.avhAccYear,
      voucherId: dto.avhVoucherId,
    });

    const settings = await this.openItemsService.loadSettings(
      header.avhCompanyId,
      header.avhBranchId,
    );
    this.assertStatusMayPost(header);

    // ── 2 · Everything §5.1 checked, checked again ─────────────────────────
    await assertAccYearWritable(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
    await assertVoucherPartitionExists(tx, header.avhAccYear, 'avhAccYear');
    await this.receiptService.assertPostable(tx, header, settings);

    const party = await loadParty(tx, header.avhCompanyId, header.avhPartyId);
    const receiptDate = startOfDay(header.avhVoucherDate);

    const { tenders, otherLines } = await this.rebuildLines(
      tx,
      header,
      receiptDate,
      settings,
      party,
    );

    // ── 3 · Lock every open item, and read what is pending NOW ─────────────
    const locked = await lockBills(tx, [
      ...dto.allocations.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })),
      ...dto.creditsApplied.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })),
    ]);

    const bills: AllocationBill[] = dto.allocations.map((row, index) => {
      const bill = assertBillUsable(locked.get(`${row.billId}|${row.billAccYear}`), {
        billId: row.billId,
        partyId: header.avhPartyId,
        companyId: header.avhCompanyId,
        kind: 'RECEIVABLE',
        field: `allocations.${index}.billId`,
      });
      return {
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        docRefno: bill.ablDocRefno,
        amount: money(row.amount),
        discount: money(row.discount ?? 0),
        writeoff: money(row.writeoff ?? 0),
        roundoff: money(row.roundoff ?? 0),
        pendingAmount: bill.ablPendingAmount,
        writeoffApprovedBy: row.writeoffApprovedBy ?? null,
      };
    });

    const credits: AllocationCredit[] = dto.creditsApplied.map((row, index) => {
      const bill = assertBillUsable(locked.get(`${row.billId}|${row.billAccYear}`), {
        billId: row.billId,
        partyId: header.avhPartyId,
        companyId: header.avhCompanyId,
        kind: 'CREDIT',
        field: `creditsApplied.${index}.billId`,
      });
      const routing = creditRouting(bill.ablBillType as BillType);
      return {
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        billType: bill.ablBillType as BillType,
        docRefno: bill.ablDocRefno,
        amount: money(row.amount),
        pendingAmount: bill.ablPendingAmount,
        adjType: routing.adjType,
        settlementMode: routing.settlementMode,
      };
    });

    this.assertWriteoffsApproved(bills, settings.writeoffApprovalAbove);

    // ── 4 & 5 · The identity and the engine ────────────────────────────────
    const plan = allocate({
      receiptDate,
      bills,
      credits,
      otherLines: otherLines.map((line) => ({
        lineNo: line.lineNo,
        role: line.role,
        ledgerId: line.ledgerId,
        drCr: line.drCr,
        amount: line.amount,
        settlesBill: line.settlesBill,
        settlementMode: line.settlementMode,
        isInstrumentSplit: line.isInstrumentSplit,
      })),
      tenders: tenders.map((tender) => ({
        tenderRowNo: tender.rowNo,
        amount: tender.amount,
        isCheque: tender.isCheque,
        isPostDated: tender.isPdc,
        instrumentDate: tender.instrumentDate,
        settlementMode: tender.settlementMode,
      })),
      pins: dto.otherLineBills.map((pin) => ({
        lineNo: pin.lineNo,
        billId: pin.billId,
        billAccYear: pin.billAccYear,
        amount: money(pin.amount),
      })),
      claimedOnAccount: money(dto.onAccount),
    });

    // ── 6, 7 & 8 · Vouchers, numbered ──────────────────────────────────────
    const vouchers = await this.planVouchers(tx, header, tenders, plan, actor);
    const byKey = new Map(vouchers.map((voucher) => [voucher.key, voucher]));
    const registerByTenderRow = await this.writeRegisterRows(tx, {
      header,
      party: header.avhPartyId,
      tenders,
      vouchers: byKey,
      receiptDate,
      actor,
      postingMode: settings.pdcPostingMode,
    });

    // ── 9 · The legs ───────────────────────────────────────────────────────
    await this.writeLegs(tx, { header, tenders, otherLines, bills, plan, vouchers: byKey, actor });

    // ── 10 · The adjustment rows ───────────────────────────────────────────
    const tenderIdByRow = await this.tenderIdsByRow(tx, header.avhVoucherId);
    await this.writeAdjustments(tx, {
      header,
      plan,
      vouchers: byKey,
      tenderIdByRow,
      registerByTenderRow,
      otherLines,
      actor,
    });

    // ── 11 · The remainders ────────────────────────────────────────────────
    await this.writeAdvanceBills(tx, { header, plan, vouchers: byKey, actor });

    // ── 12 & 13 · The instruments point at their voucher ───────────────────
    await this.linkInstruments(tx, {
      header,
      tenders,
      vouchers: byKey,
      tenderIdByRow,
      registerByTenderRow,
    });

    // ── 14 · The bill caches ───────────────────────────────────────────────
    // The TypeScript replacement for tr_abj_refresh_balance. A post-dated row
    // is written but does not count until its date arrives, which is why a
    // cheque dated today settles immediately and one dated next week does not:
    // the same recompute, the same rows, a different `asOf`.
    const touched = [
      ...bills.map((bill) => ({ billId: bill.billId, accYear: bill.billAccYear })),
      ...credits.map((credit) => ({ billId: credit.billId, accYear: credit.billAccYear })),
    ];
    const recomputed = await this.recompute.recomputeBills(tx, touched, todayUtc());
    // HANDOVER 2026-09-20 §7: a receipt against a temp-credit bill is the
    // follow-up's evidence — the WHO row remembers the last receipt that paid it.
    if (bills.length > 0) {
      await tx.$executeRaw`
        UPDATE accounts.acc_temp_credit
           SET atc_last_receipt_id = ${header.avhVoucherId}::uuid, atc_modified_on = now()
         WHERE atc_is_deleted = false
           AND (atc_abl_id, atc_abl_acc_year) IN (${Prisma.join(bills.map((b) => Prisma.sql`(${b.billId}::uuid, ${b.billAccYear}::char(9))`))})`;
    }

    // ── 15 · POSTED, last ──────────────────────────────────────────────────
    await this.postHeaders(tx, { header, vouchers, plan, tenders, otherLines, actor });

    await appendTxnStatusLog(tx, {
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      tenantId: header.avhTenantId,
      accYear: header.avhAccYear,
      srcModule: TxnStatusSrcModule.ACCOUNTS,
      srcDocType: TxnStatusDocType.RECEIPT,
      srcDocId: header.avhVoucherId,
      srcDocRefno: byKey.get(RECEIPT_VOUCHER_KEY)?.voucherRefno ?? header.avhVoucherRefno,
      event: TxnStatusEvent.POSTED,
      fromStatus: header.avhVoucherStatus,
      toStatus: VoucherStatus.POSTED,
      changedBy: actor,
      deviceId: header.avhDeviceId,
      sessionId: header.avhSessionId,
    });

    // ── 16 · The trial check (notes 47), after every write ─────────────────
    // The party's bills = its ledger; Cheques In Hand = the register. Every
    // voucher this receipt numbered is looked at — a post-dated cheque has one
    // of its own.
    await assertBooksReconcile(tx, {
      companyId: header.avhCompanyId,
      accYear: header.avhAccYear,
      ledgerIds: [header.avhPartyId],
      vouchers: vouchers.map((voucher) => ({
        voucherId: voucher.voucherId,
        accYear: voucher.accYear,
      })),
    });

    const posted = await this.receiptService.loadHeaderOrThrow(
      tx,
      header.avhVoucherId,
      header.avhAccYear,
    );
    const full = await this.receiptService.loadFullReceipt(tx, posted);
    const held = await this.postDatedHeldByBill(tx, touched);

    return {
      ...full,
      numberedVouchers: vouchers.map((voucher) => ({
        voucherId: voucher.voucherId,
        accYear: voucher.accYear,
        voucherRefno: voucher.voucherRefno,
        voucherDate: toDateString(voucher.voucherDate)!,
        docAmount: toAmount(voucher.docAmount),
        adjustAmount: toAmount(plan.adjustAmountByVoucher.get(voucher.key) ?? ZERO),
        isPdcVoucher: voucher.tenderRowNo !== null,
      })),
      billsAfter: recomputed.map((bill) => ({
        billId: bill.billId,
        billAccYear: bill.accYear,
        docRefno:
          bills.find((row) => row.billId === bill.billId)?.docRefno ??
          credits.find((row) => row.billId === bill.billId)?.docRefno ??
          '',
        billAmount: toAmount(bill.billAmount),
        pendingAmount: toAmount(bill.pendingAmount),
        postDatedHeld: toAmount(held.get(`${bill.billId}|${bill.accYear}`) ?? ZERO),
      })),
      totalOnAccount: toAmount(plan.totalOnAccount),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 1 — the lock and the gate
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * `SELECT … FOR UPDATE` on the header itself, so two clients pressing Post on
   * the same receipt cannot both get through: the second blocks here, then
   * finds the status is POSTED and is refused.
   */
  private async lockHeader(
    tx: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT avh_voucher_id
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::bpchar
         FOR UPDATE`;
  }

  /**
   * DRAFT -> POSTED. There is no approval step, and no status other than DRAFT
   * may be posted.
   *
   * A POSTED receipt refused here is the second of two clients that both
   * pressed Post: the first committed while the second was blocked on the
   * header lock above, and this is what it finds when it wakes up.
   */
  private assertStatusMayPost(header: StoredHeader): void {
    const status = statusOf(header);
    if (status === VoucherStatus.DRAFT) {
      return;
    }
    throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be posted', [
      {
        field: 'avhVoucherId',
        message:
          `${header.avhVoucherRefno ?? header.avhVoucherId} is ${status}, and only a DRAFT may be ` +
          'posted.' +
          (status === VoucherStatus.POSTED
            ? ' It has already been posted — cancel it and re-enter if the money was wrong.'
            : ''),
      },
    ]);
  }

  /**
   * A write-off strictly above `accounts.writeoff_approval_above` needs an
   * approver — and the default of 0 means every one of them does.
   *
   * Checked here, before the constraint, so the message names the bill instead
   * of `ck_abj_writeoff_approval`.
   */
  private assertWriteoffsApproved(
    bills: readonly AllocationBill[],
    threshold: Prisma.Decimal,
  ): void {
    bills.forEach((bill, index) => {
      if (bill.writeoff.lessThanOrEqualTo(0)) {
        return;
      }
      if (bill.writeoff.greaterThan(threshold) && !bill.writeoffApprovedBy) {
        throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
          {
            field: `allocations.${index}.writeoffApprovedBy`,
            message:
              `Writing off ${bill.writeoff.toFixed(2)} on ${bill.docRefno} needs an approver ` +
              `(accounts.writeoff_approval_above is ${threshold.toFixed(2)})`,
          },
        ]);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 2 — re-validating the draft
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The stored tender rows and draft lines, put back through the SAME
   * normalisation the draft went through.
   *
   * Not "trust what was saved": the masters may have changed since, a role may
   * have been remapped, a tender may have been deactivated. §5.2 step 2 says
   * re-validate 5.1, and re-running the function is the only way to be sure the
   * post and the draft agree about what a cheque is.
   */
  private async rebuildLines(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    receiptDate: Date,
    settings: Awaited<ReturnType<OpenItemsService['loadSettings']>>,
    party: Awaited<ReturnType<typeof loadParty>>,
  ): Promise<{ tenders: NormalisedTender[]; otherLines: NormalisedOtherLine[] }> {
    const draft = rehydrateDraft(header.avhDraftLines);

    const stored = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      orderBy: { tdRowNo: 'asc' },
    });

    const tenders = await normaliseTenders(tx, {
      tenders: stored.map((row) => ({
        tdId: row.tdId,
        tdRowNo: row.tdRowNo,
        tdTenderId: row.tdTenderId,
        tdTenderTypeId: row.tdTenderTypeId,
        tdTenderLedgerId: row.tdTenderLedgerId,
        tdAmount: Number(row.tdAmount),
        tdReceivedAmt: Number(row.tdReceivedAmt),
        tdChangeAmt: Number(row.tdChangeAmt),
        tdMdrAmt: Number(row.tdMdrAmt),
        tdSurchargePerc: Number(row.tdSurchargePerc),
        tdSurchargeAmt: Number(row.tdSurchargeAmt),
        tdRefNo: row.tdRefNo,
        tdAuthCode: row.tdAuthCode,
        tdCardLast4: row.tdCardLast4,
        tdBankName: row.tdBankName,
        tdPayerVpa: row.tdPayerVpa,
        tdInstrumentDate: toDateString(row.tdInstrumentDate),
        tdNotes: row.tdNotes,
        // The cheque detail acc_tender_detail has no columns for, kept on the
        // draft beside the other-ledger lines. See receipt-draft-lines.ts.
        cheque: draft.cheques[row.tdRowNo],
      })),
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      receiptDate,
    });

    const roles = new Set<string>(
      draft.otherLines.map((line) => line.role).filter((role): role is string => role !== null),
    );
    // The two the SERVER adds, and the two a bill-level reduction needs. All
    // four are required rather than merely resolved: an unmapped role
    // discovered here is discovered after the cash has been counted, which is
    // exactly why /receipts/create resolves them too and reports the gap.
    roles.add(ReceiptLedgerRole.BANK_CHARGES);
    roles.add(ReceiptLedgerRole.SURCHARGE_RECOVERED);
    roles.add(ReceiptLedgerRole.DISCOUNT_ALLOWED);
    roles.add(ReceiptLedgerRole.WRITE_OFF);
    roles.add(ReceiptLedgerRole.ROUND_OFF);

    const roleLedgers = await requireReceiptRoleLedgers(tx, [...roles], {
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
    });

    const { lines } = await normaliseOtherLines(tx, {
      lines: draft.otherLines.map((line) => ({
        role: line.role ?? undefined,
        ledgerId: line.role ? undefined : line.ledgerId,
        drCr: line.drCr,
        amount: line.amount,
        settlesBill: line.settlesBill,
        narration: line.narration,
      })),
      tenders,
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      party,
      partyId: header.avhPartyId,
      settings,
      ledgerForRole: (role) => {
        const resolved = ledgerForRole(roleLedgers, role);
        return resolved ? { ledgerId: resolved.ledgerId, ledgerName: resolved.ledgerName } : null;
      },
    });

    return { tenders, otherLines: lines };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Steps 7 & 8 — the vouchers
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The receipt, plus one voucher per POST-DATED cheque (R2).
   *
   * Why a post-dated cheque gets a voucher of its own, dated the cheque: the
   * money arrives on that day and not today. One voucher covering both would
   * have to be dated one of the two, and either choice puts money in the books
   * on a day it was not there. Two vouchers, each dated when its own money
   * moves, is the only arrangement where the bank ledger is right every day.
   *
   * The receipt keeps any number it already has — an APPROVED receipt was
   * numbered at approval, and re-numbering it here would change the document
   * the approver signed.
   */
  private async planVouchers(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    tenders: readonly NormalisedTender[],
    plan: AllocationResult,
    actor: string,
  ): Promise<PlannedVoucher[]> {
    const vouchers: PlannedVoucher[] = [];

    const receiptNumber = header.avhVoucherRefno
      ? {
          voucherNo: header.avhVoucherNo!,
          voucherSlno: header.avhVoucherSlno!,
          voucherRefno: header.avhVoucherRefno,
        }
      : await this.receiptService.allocateNumber(tx, {
          companyId: header.avhCompanyId,
          branchId: header.avhBranchId,
          accYear: header.avhAccYear,
          voucherTypeId: header.avhVoucherTypeId,
          voucherDate: header.avhVoucherDate,
        });

    if (!header.avhVoucherRefno) {
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: header.avhVoucherId,
            avhAccYear: header.avhAccYear,
          },
        },
        data: {
          avhVoucherNo: receiptNumber.voucherNo,
          avhVoucherSlno: receiptNumber.voucherSlno,
          avhVoucherRefno: receiptNumber.voucherRefno,
        },
      });
    }

    const instantTotal = sum(
      tenders.filter((tender) => !tender.isPdc).map((tender) => tender.amount),
    );

    vouchers.push({
      key: RECEIPT_VOUCHER_KEY,
      tenderRowNo: null,
      voucherDate: header.avhVoucherDate,
      accYear: header.avhAccYear,
      docAmount: instantTotal,
      voucherId: header.avhVoucherId,
      voucherNo: receiptNumber.voucherNo,
      voucherRefno: receiptNumber.voucherRefno,
    });

    for (const tender of tenders.filter((row) => row.isPdc)) {
      const voucherDate = tender.instrumentDate!;
      const accYear = accYearOf(voucherDate);
      await assertAccYearWritable(tx, header.avhCompanyId, accYear, 'tenders.tdInstrumentDate');
      // A cheque dated 2 April lands in the NEXT year, and its voucher needs a
      // partition there. This is the one place that genuinely happens.
      await assertVoucherPartitionExists(tx, accYear, 'tenders.tdInstrumentDate');

      const number = await this.receiptService.allocateNumber(tx, {
        companyId: header.avhCompanyId,
        branchId: header.avhBranchId,
        accYear,
        voucherTypeId: header.avhVoucherTypeId,
        voucherDate,
      });

      const created = await tx.accVoucherHeader.create({
        data: {
          avhCompanyId: header.avhCompanyId,
          avhBranchId: header.avhBranchId,
          avhTenantId: header.avhTenantId,
          avhAccYear: accYear,
          avhVoucherTypeId: header.avhVoucherTypeId,
          avhVoucherNo: number.voucherNo,
          avhVoucherSlno: number.voucherSlno,
          avhVoucherRefno: number.voucherRefno,
          avhVoucherDate: voucherDate,
          avhPartyId: header.avhPartyId,
          avhEmployeeId: header.avhEmployeeId,
          avhDocAmount: tender.amount,
          avhUsrRefno: header.avhUsrRefno,
          avhRemarks:
            `Post-dated ${tender.tenderName} ${tender.refNo ?? ''} on receipt ` +
            `${receiptNumber.voucherRefno}`.trim(),
          // The link that keeps this off the receipt list and under its parent
          // (§4.6). ix_avh_against is built for exactly this lookup.
          avhAgainstVoucherId: header.avhVoucherId,
          avhAgainstAccYear: header.avhAccYear,
          avhDeviceType: header.avhDeviceType,
          avhDeviceId: header.avhDeviceId,
          avhSessionId: header.avhSessionId,
          avhUserId: header.avhUserId,
          // DRAFT for now. It becomes POSTED in step 15, after its legs exist,
          // so ck_avh_balanced has something real to compare.
          avhVoucherStatus: VoucherStatus.DRAFT,
          avhCreatedBy: actor,
        },
        select: { avhVoucherId: true },
      });

      vouchers.push({
        key: pdcVoucherKey(tender.rowNo),
        tenderRowNo: tender.rowNo,
        voucherDate,
        accYear,
        docAmount: tender.amount,
        voucherId: created.avhVoucherId,
        voucherNo: number.voucherNo,
        voucherRefno: number.voucherRefno,
      });
    }

    // A voucher the engine never mentioned would be an empty header. It cannot
    // happen — every post-dated tender produces both — but an assertion here is
    // cheaper than an unbalanced voucher in the books.
    for (const key of plan.partyCreditByVoucher.keys()) {
      if (!vouchers.some((voucher) => voucher.key === key)) {
        throwAccountsBadRequest<ReceiptErrorDetail>('Allocation could not be completed', [
          {
            field: 'tenders',
            message: `The allocation names a voucher "${key}" that has no instrument`,
          },
        ]);
      }
    }

    return vouchers;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 6 — the PDC register
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * One `acc_pdc_register` row per CHEQUE tender — post-dated or not.
   *
   * Not only the post-dated ones: a cheque dated today is still a piece of
   * paper that has to be deposited, may bounce, and has to appear on the
   * Received Cheques screen. The register is the record of the INSTRUMENT; the
   * date only decides which voucher carries its legs.
   *
   * `apd_posting_mode` comes from the setting, and ON_CLEARING is refused
   * before we get here (`assertPostable`) — its rows would have to post nothing
   * now and everything later, which is the next plan.
   */
  private async writeRegisterRows(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      party: string;
      tenders: readonly NormalisedTender[];
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      receiptDate: Date;
      actor: string;
      postingMode: PdcPostingMode;
    },
  ): Promise<Map<number, { apdId: string; apdAccYear: string }>> {
    const written = new Map<number, { apdId: string; apdAccYear: string }>();

    for (const tender of params.tenders.filter((row) => row.isCheque)) {
      const voucher = tender.isPdc
        ? params.vouchers.get(pdcVoucherKey(tender.rowNo))!
        : params.vouchers.get(RECEIPT_VOUCHER_KEY)!;

      const created = await tx.accPdcRegister.create({
        data: {
          apdCompanyId: params.header.avhCompanyId,
          apdBranchId: params.header.avhBranchId,
          apdTenantId: params.header.avhTenantId,
          // The register row lives in the YEAR OF THE VOUCHER that carries it,
          // so a cheque maturing after the year end is registered in the year
          // it will actually be banked in, beside its voucher.
          apdAccYear: voucher.accYear,
          apdTraType: PdcTraType.RECEIVED,
          apdPartyId: params.party,
          apdSalesmanId: params.header.avhEmployeeId[0] ?? null,
          apdInstrumentType: PdcInstrumentType.CHEQUE,
          apdInstrumentNo: tender.refNo!,
          apdInstrumentDate: tender.instrumentDate!,
          apdAmount: tender.amount,
          apdBankName: tender.bankName,
          apdBankBranch: tender.cheque?.bankBranch ?? null,
          apdIfsc: tender.cheque?.ifsc ?? null,
          apdMicr: tender.cheque?.micr ?? null,
          apdDrawerName: tender.cheque?.drawerName ?? null,
          apdReceivedOn: params.receiptDate,
          apdBankLedgerId: tender.cheque?.bankLedgerId ?? null,
          apdPostingMode: params.postingMode,
          // ck_apd_posting: ON_RECEIPT must name its voucher, and it does —
          // the receipt for a current-dated cheque, the cheque's own voucher
          // for a post-dated one.
          apdVoucherId: voucher.voucherId,
          apdVoucherAccYear: voucher.accYear,
          apdStatus: PdcStatus.HELD,
          apdStatusOn: new Date(),
          apdStatusBy: params.actor,
          apdCreatedBy: params.actor,
        },
        select: { apdId: true, apdAccYear: true },
      });

      written.set(tender.rowNo, created);
    }

    return written;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 9 — the legs
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * §5.2 step 9, per voucher.
   *
   * ── The instrument leg ───────────────────────────────────────────────────
   * DR the money, NET of what never arrives. A card collection of 15,000 with
   * 10 of MDR debits the bank 14,990 and Bank Charges 10, while the PARTY is
   * credited the full 15,000 — because the customer paid 15,000 and the
   * acquirer's cut is our cost, not their short payment. When the tender master
   * names a clearing ledger the money goes there instead of to the bank, and
   * waits until the acquirer settles.
   *
   * ── The party leg ────────────────────────────────────────────────────────
   * ONE per voucher, and its amount comes from the engine — which derived it
   * from the BILL side. That is the point: the ledger and the bill sub-ledger
   * are then equal by construction rather than by a check that can fail.
   *
   * ── What has NO leg ──────────────────────────────────────────────────────
   * A credit applied. See the long note at the top of allocation-engine.ts: the
   * advance was credited to the PARTY when it was received, so spending it
   * moves nothing in the ledger — only in the bill sub-ledger, where the pair of
   * adjustment rows records it.
   */
  private async writeLegs(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      tenders: readonly NormalisedTender[];
      otherLines: readonly NormalisedOtherLine[];
      bills: readonly AllocationBill[];
      plan: AllocationResult;
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      actor: string;
    },
  ): Promise<void> {
    const { header, plan, vouchers } = params;

    for (const voucher of vouchers.values()) {
      const rows: Prisma.AccVoucherUncheckedCreateInput[] = [];
      let rowNo = 1;

      const push = (
        drCr: DrCr,
        ledgerId: string,
        amount: Prisma.Decimal,
        role: string | null,
        remarks: string | null,
      ): void => {
        if (amount.lessThanOrEqualTo(0)) {
          // ck_av_amount refuses a zero leg, and a zero leg says nothing anyway.
          return;
        }
        rows.push({
          avVoucherId: voucher.voucherId,
          avCompanyId: header.avhCompanyId,
          avBranchId: header.avhBranchId,
          avTenantId: header.avhTenantId,
          avAccYear: voucher.accYear,
          avVoucherTypeId: header.avhVoucherTypeId,
          avVoucherNo: voucher.voucherNo,
          avRowNo: rowNo++,
          avVoucherDate: voucher.voucherDate,
          avVoucherRefno: voucher.voucherRefno,
          avDrCr: drCr,
          avLedgerId: ledgerId,
          avAmount: amount,
          avRole: role,
          avRemarks: remarks,
          avSessionId: header.avhSessionId,
          avUserId: header.avhUserId,
          avCreatedBy: params.actor,
        });
      };

      const tendersHere = params.tenders.filter((tender) =>
        voucher.tenderRowNo === null ? !tender.isPdc : tender.rowNo === voucher.tenderRowNo,
      );

      for (const tender of tendersHere) {
        push(
          DrCr.DR,
          tender.clearingLedgerId ?? tender.tenderLedgerId,
          tender.amount.minus(tender.mdrAmt),
          null,
          tender.refNo ? `${tender.tenderName} ${tender.refNo}` : tender.tenderName,
        );
      }

      // The other-ledger band and the two reductions belong to the RECEIPT
      // voucher: they were agreed when the money was taken, not when a cheque
      // matures three weeks later.
      if (voucher.tenderRowNo === null) {
        for (const line of params.otherLines) {
          push(line.drCr, line.ledgerId, line.amount, line.role, line.narration);
        }
        await this.pushReduction(
          tx,
          push,
          params,
          ReceiptLedgerRole.DISCOUNT_ALLOWED,
          (bill) => bill.discount,
        );
        await this.pushReduction(
          tx,
          push,
          params,
          ReceiptLedgerRole.WRITE_OFF,
          (bill) => bill.writeoff,
        );
        await this.pushReduction(
          tx,
          push,
          params,
          ReceiptLedgerRole.ROUND_OFF,
          (bill) => bill.roundoff,
        );
      }

      push(
        DrCr.CR,
        header.avhPartyId,
        plan.partyCreditByVoucher.get(voucher.key) ?? ZERO,
        // NULL: the party is not a role. §2.6.
        null,
        null,
      );

      if (rows.length > 0) {
        await tx.accVoucher.createMany({ data: rows });
      }
    }
  }

  private async pushReduction(
    tx: Prisma.TransactionClient,
    push: (
      drCr: DrCr,
      ledgerId: string,
      amount: Prisma.Decimal,
      role: string | null,
      remarks: string | null,
    ) => void,
    params: { bills: readonly AllocationBill[]; header: StoredHeader },
    role: ReceiptLedgerRole,
    pick: (bill: AllocationBill) => Prisma.Decimal,
  ): Promise<void> {
    const total = sum(params.bills.map(pick));
    if (total.lessThanOrEqualTo(0)) {
      return;
    }
    const resolved = await requireReceiptRoleLedgers(tx, [role], {
      companyId: params.header.avhCompanyId,
      branchId: params.header.avhBranchId,
    });
    const ledger = ledgerForRole(resolved, role)!;
    // ONE leg for the whole receipt, not one per bill: the ledger records the
    // expense, and which bills it was spread over is what the adjustment rows
    // are for.
    push(DrCr.DR, ledger.ledgerId, total, role, null);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 10 — the adjustment rows
  // ═════════════════════════════════════════════════════════════════════════

  private async writeAdjustments(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      plan: AllocationResult;
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      tenderIdByRow: ReadonlyMap<number, string>;
      registerByTenderRow: ReadonlyMap<number, { apdId: string; apdAccYear: string }>;
      otherLines: readonly NormalisedOtherLine[];
      actor: string;
    },
  ): Promise<void> {
    const { header, plan } = params;
    const ledgerByLineNo = new Map(params.otherLines.map((line) => [line.lineNo, line.ledgerId]));
    const rowNoByVoucher = new Map<VoucherKey, number>();

    const rows: Prisma.AccBillAdjustmentUncheckedCreateInput[] = plan.adjustments.map(
      (adjustment: AllocationAdjustment) => {
        const voucher = params.vouchers.get(adjustment.voucherKey)!;
        const rowNo = (rowNoByVoucher.get(adjustment.voucherKey) ?? 0) + 1;
        rowNoByVoucher.set(adjustment.voucherKey, rowNo);

        const register =
          adjustment.tenderRowNo === null
            ? undefined
            : params.registerByTenderRow.get(adjustment.tenderRowNo);

        return {
          abjCompanyId: header.avhCompanyId,
          abjBranchId: header.avhBranchId,
          abjTenantId: header.avhTenantId,
          // The row is partitioned with the VOUCHER that caused it, while
          // abj_bill_acc_year keeps the bill's own year — which is how a
          // receipt in 2026-2027 settles a bill raised in 2025-2026.
          abjAccYear: voucher.accYear,
          abjBillId: adjustment.billId,
          abjBillAccYear: adjustment.billAccYear,
          abjPartyId: header.avhPartyId,
          abjRowNo: rowNo,
          abjAgainstBillId: adjustment.againstBill?.billId ?? null,
          abjAgainstBillAccYear: adjustment.againstBill?.billAccYear ?? null,
          abjVoucherId: voucher.voucherId,
          abjVoucherAccYear: voucher.accYear,
          abjAdjType: adjustment.adjType,
          abjAdjDate: adjustment.adjDate,
          abjDrCr: adjustment.drCr,
          abjAmount: adjustment.amount,
          abjSettlementMode: adjustment.settlementMode,
          abjSettlementLedgerId:
            adjustment.otherLineNo === null
              ? null
              : (ledgerByLineNo.get(adjustment.otherLineNo) ?? null),
          abjTenderId:
            adjustment.tenderRowNo === null
              ? null
              : (params.tenderIdByRow.get(adjustment.tenderRowNo) ?? null),
          abjTenderAccYear: adjustment.tenderRowNo === null ? null : header.avhAccYear,
          // ck_abj_cheque_mode: a CHEQUE-mode row must name its instrument, and
          // ck_abj_pdc: a post-dated row must too.
          abjChequeId: register?.apdId ?? null,
          abjChequeAccYear: register?.apdAccYear ?? null,
          abjIsPostDated: adjustment.isPostDated,
          abjApprovedBy: adjustment.approvedBy,
          abjRemarks: adjustment.remarks,
          abjUserId: header.avhUserId,
          abjSessionId: header.avhSessionId,
          abjCreatedBy: params.actor,
        };
      },
    );

    if (rows.length > 0) {
      await tx.accBillAdjustment.createMany({ data: rows });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 11 — the remainders
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * R7 — a remainder is ALWAYS an ADVANCE bill, one per voucher that has one.
   *
   * Always, and never "unreferenced money on the party's account" (R11): an
   * advance with a bill can be aged, offered on the next receipt, reported and
   * refunded. A bare credit balance can only be looked at.
   *
   * Dated the VOUCHER: a post-dated cheque's remainder becomes an advance on
   * the day the cheque clears, not today, because that is the day the money is
   * ours to hold.
   */
  private async writeAdvanceBills(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      plan: AllocationResult;
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      actor: string;
    },
  ): Promise<void> {
    for (const entry of params.plan.onAccount) {
      if (entry.amount.lessThanOrEqualTo(0)) {
        continue;
      }
      const voucher = params.vouchers.get(entry.voucherKey)!;

      await tx.accBillBalance.create({
        data: {
          ablCompanyId: params.header.avhCompanyId,
          ablBranchId: params.header.avhBranchId,
          ablTenantId: params.header.avhTenantId,
          ablAccYear: voucher.accYear,
          ablPartyId: params.header.avhPartyId,
          ablSalesmanId: params.header.avhEmployeeId[0] ?? null,
          ablBillType: BillType.ADVANCE,
          ablSrcModule: RECEIPT_SRC_MODULE,
          ablSrcDocType: ADVANCE_SRC_DOC_TYPE,
          ablSrcDocId: voucher.voucherId,
          ablSrcAccYear: voucher.accYear,
          // ck_abl_voucher: a non-OPENING bill MUST name its voucher and type.
          ablVoucherId: voucher.voucherId,
          ablVoucherTypeId: params.header.avhVoucherTypeId,
          ablVoucherNo: voucher.voucherNo,
          ablVoucherDate: voucher.voucherDate,
          ablVoucherRefno: voucher.voucherRefno,
          // ux_abl_doc_refno is (company, party, type, year, refno): the
          // voucher's own number is unique within all of those by
          // construction, so an advance can never collide with another.
          ablDocRefno: voucher.voucherRefno,
          ablDocDate: voucher.voucherDate,
          // An advance has no due date. It is not owed by anybody; it is held.
          ablDueDate: null,
          // CR — the company owes the party. The side is what keeps this off
          // the receivables list and on the credits list.
          ablDrCr: DrCr.CR,
          ablBillAmount: entry.amount,
          ablNarration: `On account from receipt ${voucher.voucherRefno}`,
          ablCreatedBy: params.actor,
        },
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Steps 12 & 13 — the instruments point at their voucher
  // ═════════════════════════════════════════════════════════════════════════

  private async linkInstruments(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      tenders: readonly NormalisedTender[];
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      tenderIdByRow: ReadonlyMap<number, string>;
      registerByTenderRow: ReadonlyMap<number, { apdId: string; apdAccYear: string }>;
    },
  ): Promise<void> {
    for (const tender of params.tenders) {
      const voucher = tender.isPdc
        ? params.vouchers.get(pdcVoucherKey(tender.rowNo))!
        : params.vouchers.get(RECEIPT_VOUCHER_KEY)!;
      const tenderId = params.tenderIdByRow.get(tender.rowNo);
      if (!tenderId) {
        continue;
      }

      await tx.accTenderDetail.update({
        where: { tdId_tdAccYear: { tdId: tenderId, tdAccYear: params.header.avhAccYear } },
        // §5.2 step 12 — the voucher CARRYING THIS INSTRUMENT, which for a
        // post-dated cheque is not the receipt. Anything reconciling a bank
        // statement follows this link, and pointing it at the receipt would put
        // the cheque in the wrong month.
        data: { tdVoucherId: voucher.voucherId },
      });

      const register = params.registerByTenderRow.get(tender.rowNo);
      if (register) {
        await tx.accPdcRegister.update({
          where: { apdId_apdAccYear: { apdId: register.apdId, apdAccYear: register.apdAccYear } },
          data: { apdTenderId: tenderId },
        });
      }
    }
  }

  private async tenderIdsByRow(
    tx: Prisma.TransactionClient,
    voucherId: string,
  ): Promise<Map<number, string>> {
    const rows = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      select: { tdId: true, tdRowNo: true },
    });
    return new Map(rows.map((row) => [row.tdRowNo, row.tdId]));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 15 — POSTED, last
  // ═════════════════════════════════════════════════════════════════════════

  private async postHeaders(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      vouchers: readonly PlannedVoucher[];
      plan: AllocationResult;
      tenders: readonly NormalisedTender[];
      otherLines: readonly NormalisedOtherLine[];
      actor: string;
    },
  ): Promise<void> {
    const now = new Date();

    for (const voucher of params.vouchers) {
      // tr_av_refresh_totals has already written these from the legs. This
      // re-derives them so an unbalanced voucher is refused with a message
      // naming it, rather than by ck_avh_balanced with a 23514 that names
      // nothing — and so the trigger and the service can never quietly
      // disagree about the same legs.
      const totals = await deriveVoucherTotals(tx, voucher.voucherId, voucher.accYear);
      if (!totals.difference.isZero()) {
        // The constraint would catch this too, as a 23514 naming
        // ck_avh_balanced. This says which voucher and by how much.
        throwAccountsBadRequest<ReceiptErrorDetail>('The voucher does not balance', [
          {
            field: 'avhVoucherId',
            message:
              `${voucher.voucherRefno} is out by ${totals.difference.toFixed(2)} ` +
              `(debit ${totals.totalDebit.toFixed(2)}, credit ${totals.totalCredit.toFixed(2)})`,
          },
        ]);
      }

      const instrumentLedgers = new Set(
        params.tenders
          .filter((tender) =>
            voucher.tenderRowNo === null ? !tender.isPdc : tender.rowNo === voucher.tenderRowNo,
          )
          .map((tender) => tender.clearingLedgerId ?? tender.tenderLedgerId),
      );

      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: voucher.voucherId,
            avhAccYear: voucher.accYear,
          },
        },
        data: {
          avhDocAmount: voucher.docAmount,
          // Derived from the rows the engine produced, never stamped from the
          // request (§12).
          avhAdjustAmount: params.plan.adjustAmountByVoucher.get(voucher.key) ?? ZERO,
          // Meaningful only when there is exactly one, which is the case this
          // field exists for: a two-leg voucher reads on its own in the daybook.
          avhOppositeLedgerId: instrumentLedgers.size === 1 ? [...instrumentLedgers][0] : null,
          // A receipt collects what the bills say. There is nothing to round.
          avhRoundOff: ZERO,
          avhVoucherStatus: VoucherStatus.POSTED,
          avhStatusOn: now,
          avhStatusBy: params.actor,
          avhPostedOn: now,
          // Scratch space, cleared. The lines are legs now.
          avhDraftLines: Prisma.DbNull,
          avhModifiedOn: now,
          avhModifiedBy: params.actor,
        },
      });
    }
  }

  /** What each bill still has promised to it but not yet matured, after the post. */
  private async postDatedHeldByBill(
    tx: Prisma.TransactionClient,
    bills: readonly { billId: string; accYear: string }[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (bills.length === 0) {
      return new Map();
    }
    const rows = await tx.accBillAdjustment.findMany({
      where: {
        abjIsDeleted: false,
        abjIsPostDated: true,
        abjAdjDate: { gt: todayUtc() },
        OR: bills.map((bill) => ({ abjBillId: bill.billId, abjBillAccYear: bill.accYear })),
      },
      select: { abjBillId: true, abjBillAccYear: true, abjAmount: true },
    });

    const held = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const key = `${row.abjBillId}|${row.abjBillAccYear}`;
      held.set(key, (held.get(key) ?? ZERO).plus(row.abjAmount));
    }
    return held;
  }
}

/**
 * The engine is pure and knows nothing about HTTP, so its two failure kinds are
 * mapped here — ONCE — rather than being thrown as status codes from inside
 * arithmetic.
 *
 * Shared with `/receipts/amend`, whose re-apply runs the same engine and must
 * answer with the same 400 or 409 rather than a 500 that says `AllocationError`.
 *
 * Returns `never` in practice: both branches throw. It is typed as returning
 * the error so a caller can write `throw rethrowAllocationError(error)` and
 * keep TypeScript's control-flow analysis, which a bare `void` call loses.
 */
export function rethrowAllocationError(error: unknown): unknown {
  if (error instanceof AllocationError) {
    if (error.kind === 'CONFLICT') {
      throwAccountsConflict<ReceiptErrorDetail>(error.message, error.details);
    }
    throwAccountsBadRequest<ReceiptErrorDetail>(error.message, error.details);
  }
  return error;
}

/** A `timestamptz` column holding a document DATE, read as the date it is. */
function startOfDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}
