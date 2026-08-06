import { Prisma } from '@prisma/client';
import { throwSalesBadRequest } from 'src/common/utils/module-service.utils';
import { BillErrorDetail, BillErrorResponse } from './types/bill-api.types';
// Guards the company-wide voucher serial. avh_voucher_slno is unique per
// (company, acc_year) across EVERY voucher type (ux_avh_voucher_slno), so two
// concurrent posts of different document types would otherwise pick the same
// number and one of them would 500 on the unique index.
const VOUCHER_SLNO_LOCK_NAMESPACE = 'accounts.acc_voucher_header.voucher_slno';
// ck_avh_src on acc_voucher_header wants all three src_* columns or none, and
// ux_avh_src makes (company, module, doc_type, doc_id, acc_year) unique — which
// is what stops the same bill being posted to accounts twice.
const BILL_SRC_MODULE = 'SALES';
const BILL_SRC_DOC_TYPE = 'BILL';
// acc_bills.abl_bill_type — a sale bill always raises a SALES bill reference.
const BILL_REF_TYPE = 'SALES';
// DR = receivable. A sale puts the customer into debit.
const BILL_DR_CR = 'DR';
// sale_bill.sb_device_type is free text (observed: 'Desktop'); this normalises
// its casing onto the ck_avh_device_type value set, which accepts
// PC / WEB / MOBILE / POS / DESKTOP (DESKTOP added by migration
// 20260806120000_widen_avh_device_type). Anything unmapped becomes NULL rather
// than failing the whole post — the column is nullable and the device is
// already recorded on the bill itself.
const DEVICE_TYPE_MAP: Record<string, string> = {
  DESKTOP: 'DESKTOP',
  WEB: 'WEB',
  MOBILE: 'MOBILE',
};
// abl_doc_refno is VarChar(50) but sb_usr_refno is VarChar(100).
const BILL_DOC_REFNO_MAX_LENGTH = 50;
// sale_bill.sb_status value that means "accounts must carry a live voucher".
const BILL_STATUS_POSTED = 'POSTED';
// ck_avh_status values this helper writes.
const VOUCHER_STATUS_POSTED = 'POSTED';
const VOUCHER_STATUS_CANCELLED = 'CANCELLED';
// ck_avh_cancel demands a reason on every cancellation (MCA Rule 3(1) audit
// trail) and the bill itself need not carry one, so unposting falls back to
// this. avh_cancel_reason is VarChar(250).
const DEFAULT_CANCEL_REASON = 'Sale bill is no longer posted';
// Same rule, for the delete path: the bill itself is gone, so it can no longer
// supply a reason of its own.
const DELETE_CANCEL_REASON = 'Sale bill deleted';
const CANCEL_REASON_MAX_LENGTH = 250;
/// Identifies the bill in accounts. Everything keyed off the source document
/// (ux_avh_src) needs only these three columns, so the delete path can be run
/// from the stored row without assembling a whole BillPostingSource.
export interface BillPostingRef {
  sbId: string;
  sbCompanyId: string;
  sbAccYear: string;
}
/// The subset of a created SaleBill row this helper needs. Declared
/// structurally rather than as the Prisma model so callers can pass the row
/// straight through without a cast.
export interface BillPostingSource extends BillPostingRef {
  sbBranchId: string;
  sbTenantId: string | null;
  sbBillSlno: bigint | null;
  sbBillRefno: string | null;
  sbUsrRefno: string | null;
  sbBillDate: Date;
  sbBillDatetime: Date;
  sbDueDate: Date | null;
  sbDueDays: number | null;
  sbCustId: string;
  sbUserId: string;
  sbSessionId: string | null;
  sbDeviceType: string | null;
  sbDeviceId: string | null;
  sbSalesmanId: string[];
  sbAgentId: string | null;
  sbBillAmt: Prisma.Decimal;
  sbRoundOff: Prisma.Decimal | null;
  sbPaidAmt: Prisma.Decimal;
  sbRemarks: string | null;
  // Drives the update path: whether accounts should carry a live voucher for
  // this bill at all. Unused by postBillToAccounts, which the caller only
  // reaches once it has already decided the bill is POSTED.
  sbStatus: string;
  sbCancelReason: string | null;
}
export interface BillPostingResult {
  // accounts.acc_voucher_header.avh_voucher_id — written back to
  // sale_bill.sb_posted_voucher_id.
  voucherId: string;
  // accounts.acc_bills.abl_id, or null when the bill carries no receivable.
  billId: string | null;
  postedOn: Date;
}
/// Posts a POSTED sale bill into accounts: one acc_voucher_header row and (when
/// the bill has a value) one acc_bills row.
///
/// Must run inside the caller's transaction so the accounting rows commit with
/// the bill itself — a bill that says POSTED but has no voucher behind it is
/// exactly the inconsistency this is meant to prevent.
export async function postBillToAccounts(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
  vchrTypeId: number,
  actor: string,
  postedOn: Date,
): Promise<BillPostingResult> {
  // ck_avh_no: anything past DRAFT must carry a number and a refno. Both are
  // server-assigned on create, so a missing one means the caller posted a bill
  // that never went through allocateVoucherNumber.
  if (bill.sbBillSlno === null || !bill.sbBillRefno) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be posted', [
      {
        field: 'sbStatus',
        message: 'A POSTED bill must have a bill number (sbBillSlno / sbBillRefno) assigned.',
      },
    ]);
  }
  // throwSalesBadRequest returns never, so both are narrowed past the guard.
  const billSlno = bill.sbBillSlno;
  const billRefno = bill.sbBillRefno;
  const voucherSlno = await allocateVoucherSlno(tx, bill.sbCompanyId, bill.sbAccYear);
  const billAmount = bill.sbBillAmt ?? new Prisma.Decimal(0);
  const header = await tx.accVoucherHeader.create({
    data: {
      avhCompanyId: bill.sbCompanyId,
      avhBranchId: bill.sbBranchId,
      avhTenantId: bill.sbTenantId,
      avhAccYear: bill.sbAccYear,
      avhVoucherTypeId: vchrTypeId,
      // The voucher IS the invoice: it reuses the bill's own number and refno
      // so the day book and the invoice agree. Only the company-wide serial is
      // allocated separately.
      avhVoucherNo: billSlno,
      avhVoucherSlno: voucherSlno,
      avhVoucherRefno: billRefno,
      avhVoucherDate: bill.sbBillDatetime ?? bill.sbBillDate,
      avhSrcModule: BILL_SRC_MODULE,
      avhSrcDocType: BILL_SRC_DOC_TYPE,
      avhSrcDocId: bill.sbId,
      avhUsrRefno: bill.sbUsrRefno,
      avhDocRefno: billRefno,
      avhDocDate: bill.sbBillDate,
      avhDocAmount: billAmount,
      avhRoundOff: bill.sbRoundOff ?? 0,
      // ck_avh_balanced: a POSTED voucher must balance. The bill total is both
      // the debit (customer) and the credit (sales + tax) side; the per-ledger
      // split lives in acc_vouchers, which this helper does not write.
      avhTotalDebit: billAmount,
      avhTotalCredit: billAmount,
      // Customer and ledger share a primary key, so sbCustId is already the
      // acc_ledger_master id.
      avhPartyId: bill.sbCustId,
      // Left NULL deliberately: the sales ledger is per line (item tax master's
      // taxSalesLedgerId), so a mixed-rate bill has no single contra ledger.
      avhOppositeLedgerId: null,
      // Scalar list — Prisma rejects null here.
      avhEmployeeId: bill.sbSalesmanId ?? [],
      avhRemarks: bill.sbRemarks,
      avhVoucherStatus: VOUCHER_STATUS_POSTED,
      // ck_avh_status_on / ck_avh_posted_on: anything past DRAFT must say when
      // and by whom, and POSTED must carry a posted-on.
      avhStatusOn: postedOn,
      avhStatusBy: bill.sbUserId,
      avhPostedOn: postedOn,
      avhUserId: bill.sbUserId,
      avhSessionId: bill.sbSessionId,
      avhDeviceType: mapDeviceType(bill.sbDeviceType),
      avhDeviceId: bill.sbDeviceId,
      avhCreatedOn: postedOn,
      avhCreatedBy: actor,
    },
    select: { avhVoucherId: true },
  });
  // ck_abl_amount requires a positive bill amount, so a zero-value bill gets a
  // voucher but no receivable — there is nothing to collect.
  let billId: string | null = null;
  if (billAmount.greaterThan(0)) {
    // ck_abl_settled: alloc + disc + writeoff can never exceed the bill. An
    // overpayment is recorded on the tender, not as over-allocation here.
    const paid = bill.sbPaidAmt ?? new Prisma.Decimal(0);
    const allocated = paid.greaterThan(billAmount) ? billAmount : paid;
    const created = await tx.accBill.create({
      data: {
        ablCompanyId: bill.sbCompanyId,
        ablBranchId: bill.sbBranchId,
        ablTenantId: bill.sbTenantId,
        ablAccYear: bill.sbAccYear,
        ablPartyId: bill.sbCustId,
        // acc_bills carries a single salesman; the bill carries an array.
        ablSalesmanId: bill.sbSalesmanId?.[0] ?? null,
        ablAgentId: bill.sbAgentId,
        ablBillType: BILL_REF_TYPE,
        ablVoucherId: header.avhVoucherId,
        ablVoucherTypeId: vchrTypeId,
        ablVoucherNo: billSlno,
        ablDocDate: bill.sbBillDate,
        ablDocRefno: bill.sbUsrRefno?.slice(0, BILL_DOC_REFNO_MAX_LENGTH) ?? null,
        ablBillRefno: billRefno,
        ablBillDate: bill.sbBillDate,
        ablDueDate: bill.sbDueDate,
        ablCreditDays: bill.sbDueDays ?? 0,
        ablDrCr: BILL_DR_CR,
        ablBillAmount: billAmount,
        // abl_pending_amount is generated as bill - alloc - disc - writeoff, so
        // seeding alloc with what was already tendered leaves the outstanding
        // equal to the bill's own balance. A fully-paid cash bill lands at 0.
        ablAllocAmount: allocated,
        ablNarration: bill.sbRemarks,
        ablCreatedOn: postedOn,
        ablCreatedBy: actor,
      },
      select: { ablId: true },
    });
    billId = created.ablId;
  }
  return { voucherId: header.avhVoucherId, billId, postedOn };
}
/// What syncBillPosting did to the books.
///   created   — the bill entered the books (first post, or a DRAFT posted later)
///   updated   — an already-posted bill's voucher and receivable were re-synced
///   cancelled — the bill left the books; its voucher is now CANCELLED
///   unchanged — the bill was not posted before and is not posted now
export type BillPostingAction = 'created' | 'updated' | 'cancelled' | 'unchanged';
export interface BillPostingSyncResult {
  action: BillPostingAction;
  // Both null once the bill is no longer posted, so the caller can clear
  // sale_bill.sb_posted_voucher_id / sb_posted_on in the same write.
  voucherId: string | null;
  billId: string | null;
  postedOn: Date | null;
}
/// Brings accounts in line with a bill that has just been updated.
///
/// The bill's own sbStatus is the whole input: POSTED means accounts must carry
/// a live voucher, anything else means it must not. That covers every
/// transition the update path can produce without the caller having to compare
/// the before/after status itself.
///
/// Deliberately keyed off the source document (ux_avh_src) rather than
/// sale_bill.sb_posted_voucher_id: that column is client-writable through the
/// payload's optional fields, so trusting it would let a caller point a bill at
/// someone else's voucher.
///
/// Must run inside the caller's transaction, for the same reason as
/// postBillToAccounts.
export async function syncBillPosting(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
  vchrTypeId: number,
  actor: string,
  now: Date,
): Promise<BillPostingSyncResult> {
  const live = await findLiveVoucher(tx, bill);
  if (bill.sbStatus === BILL_STATUS_POSTED) {
    if (live) {
      const billId = await syncPostedVoucher(tx, bill, live, vchrTypeId, actor, now);
      return {
        action: 'updated',
        voucherId: live.avhVoucherId,
        billId,
        postedOn: live.avhPostedOn,
      };
    }
    // No live voucher, but a cancelled one may still hold this bill's number:
    // ux_avh_voucher_no only excludes DRAFT and deleted rows, so re-posting
    // would collide on avh_voucher_no. Answer 400 instead of a raw 23505.
    await ensureNotPreviouslyCancelled(tx, bill);
    const created = await postBillToAccounts(tx, bill, vchrTypeId, actor, now);
    return {
      action: 'created',
      voucherId: created.voucherId,
      billId: created.billId,
      postedOn: created.postedOn,
    };
  }
  if (live) {
    await cancelPostedVoucher(tx, bill, live, actor, now);
    return { action: 'cancelled', voucherId: null, billId: null, postedOn: null };
  }
  return { action: 'unchanged', voucherId: null, billId: null, postedOn: null };
}
/// What deleteBillPosting took out of the books.
export interface BillPostingDeleteResult {
  // The vouchers that were soft-deleted — empty when the bill was never posted.
  voucherIds: string[];
  // The receivables that went with them.
  billIds: string[];
}
/// Takes a soft-deleted bill's accounting rows out of the books: the
/// acc_voucher_header raised for it, its acc_vouchers ledger lines and any
/// acc_bills receivable are all flagged deleted.
///
/// This is the delete counterpart of syncBillPosting's cancel branch, and
/// differs from it deliberately: unposting a bill that still exists only
/// *cancels* the voucher (the number stays consumed, and the cancelled row goes
/// on blocking a re-post), whereas deleting the bill removes the rows that
/// pointed at it — nothing may keep referencing a document that is gone.
///
/// Runs off the source document (ux_avh_src) rather than
/// sale_bill.sb_posted_voucher_id, for the same reason syncBillPosting does:
/// that column is client-writable.
///
/// Must run inside the caller's transaction so the books and the bill go at the
/// same moment.
export async function deleteBillPosting(
  tx: Prisma.TransactionClient,
  bill: BillPostingRef,
  actor: string,
  now: Date,
): Promise<BillPostingDeleteResult> {
  // Normally at most one, and only a POSTED bill has one at all. Cancelled
  // headers are included: a cancelled voucher only outlives its bill while the
  // bill is still there to be re-billed against.
  const headers = await tx.accVoucherHeader.findMany({
    where: {
      avhCompanyId: bill.sbCompanyId,
      avhAccYear: bill.sbAccYear,
      avhSrcModule: BILL_SRC_MODULE,
      avhSrcDocType: BILL_SRC_DOC_TYPE,
      avhSrcDocId: bill.sbId,
      avhIsDeleted: false,
    },
    select: { avhVoucherId: true, avhAccYear: true },
  });
  const result: BillPostingDeleteResult = { voucherIds: [], billIds: [] };
  for (const header of headers) {
    result.billIds.push(...(await deleteReceivables(tx, header, actor, now)));
    // The per-ledger split. Nothing in this module writes acc_vouchers yet (the
    // sales ledger is per line), but a voucher that acquires its lines
    // elsewhere must not keep live ledger rows behind a deleted header.
    await tx.accVoucher.updateMany({
      where: {
        avVoucherId: header.avhVoucherId,
        avAccYear: header.avhAccYear,
        avIsDeleted: false,
      },
      data: {
        avIsActive: false,
        avIsDeleted: true,
        avModifiedOn: now,
        avModifiedBy: actor,
      },
    });
    await tx.accVoucherHeader.update({
      where: {
        avhVoucherId_avhAccYear: {
          avhVoucherId: header.avhVoucherId,
          avhAccYear: header.avhAccYear,
        },
      },
      data: {
        // Deleted and cancelled: a row left saying POSTED would still be read
        // as live by anything that filters on status rather than the flag.
        avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
        // ck_avh_cancel / ck_avh_status_on, as in cancelPostedVoucher.
        avhCancelReason: DELETE_CANCEL_REASON,
        avhStatusOn: now,
        avhStatusBy: actor,
        avhIsActive: false,
        avhIsDeleted: true,
        avhModifiedOn: now,
        avhModifiedBy: actor,
      },
    });
    result.voucherIds.push(header.avhVoucherId);
  }
  return result;
}
// The receivables raised against one voucher. A bill with money already
// settled against it cannot be deleted — that receipt would be left pointing
// at a document that no longer exists — so this refuses rather than orphaning
// the allocation.
async function deleteReceivables(
  tx: Prisma.TransactionClient,
  header: { avhVoucherId: string; avhAccYear: string },
  actor: string,
  now: Date,
): Promise<string[]> {
  const receivables = await tx.accBill.findMany({
    where: {
      ablVoucherId: header.avhVoucherId,
      ablAccYear: header.avhAccYear,
      ablIsDeleted: false,
    },
    select: {
      ablId: true,
      ablBillRefno: true,
      ablAllocAmount: true,
      ablDiscAmount: true,
      ablWriteoffAmount: true,
    },
  });
  const deleted: string[] = [];
  for (const receivable of receivables) {
    ensureNothingSettledForDelete(receivable);
    await retireReceivable(tx, receivable.ablId, actor, now);
    deleted.push(receivable.ablId);
  }
  return deleted;
}
// abl_alloc_amount is seeded with what the customer tendered at post time, so
// a cash bill is "settled" against itself without any adjustment existing. Only
// a real adjustment — a receipt allocated against the bill — blocks the delete.
function ensureNothingSettledForDelete(receivable: {
  ablBillRefno: string | null;
  ablDiscAmount: Prisma.Decimal;
  ablWriteoffAmount: Prisma.Decimal;
}): void {
  const settled = receivable.ablDiscAmount.plus(receivable.ablWriteoffAmount);
  if (settled.greaterThan(0)) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be deleted', [
      {
        field: 'sbId',
        message:
          `Bill ${receivable.ablBillRefno ?? ''} has ${settled.toString()} discounted or written ` +
          `off against it in accounts, so it cannot be deleted. Reverse the settlement first.`.trim(),
      },
    ]);
  }
}
// The voucher this bill is currently posted through, if any. Cancelled and
// deleted vouchers are not live — they are exactly what ux_avh_src excludes.
async function findLiveVoucher(
  tx: Prisma.TransactionClient,
  bill: BillPostingRef,
): Promise<{ avhVoucherId: string; avhAccYear: string; avhPostedOn: Date | null } | null> {
  return tx.accVoucherHeader.findFirst({
    where: {
      avhCompanyId: bill.sbCompanyId,
      avhAccYear: bill.sbAccYear,
      avhSrcModule: BILL_SRC_MODULE,
      avhSrcDocType: BILL_SRC_DOC_TYPE,
      avhSrcDocId: bill.sbId,
      avhIsDeleted: false,
      avhVoucherStatus: { not: VOUCHER_STATUS_CANCELLED },
    },
    select: { avhVoucherId: true, avhAccYear: true, avhPostedOn: true },
  });
}
// A bill whose voucher was cancelled cannot go back into the books under the
// same bill number — the cancelled voucher still owns that avh_voucher_no.
// Re-billing is a new document, not an edit of this one.
async function ensureNotPreviouslyCancelled(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
): Promise<void> {
  const cancelled = await tx.accVoucherHeader.findFirst({
    where: {
      avhCompanyId: bill.sbCompanyId,
      avhAccYear: bill.sbAccYear,
      avhSrcModule: BILL_SRC_MODULE,
      avhSrcDocType: BILL_SRC_DOC_TYPE,
      avhSrcDocId: bill.sbId,
      avhIsDeleted: false,
      avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
    },
    select: { avhVoucherId: true },
  });
  if (cancelled) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be posted', [
      {
        field: 'sbStatus',
        message:
          'This bill was already posted and cancelled in accounts; it cannot be posted again. Raise a new bill instead.',
      },
    ]);
  }
}
// Re-syncs an already-posted bill. The voucher's identity (number, serial,
// refno, posted-on) is fixed at first post and deliberately left alone — only
// what the user can still edit on the bill is carried across.
async function syncPostedVoucher(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
  live: { avhVoucherId: string; avhAccYear: string },
  vchrTypeId: number,
  actor: string,
  now: Date,
): Promise<string | null> {
  const billAmount = bill.sbBillAmt ?? new Prisma.Decimal(0);
  await tx.accVoucherHeader.update({
    where: {
      avhVoucherId_avhAccYear: {
        avhVoucherId: live.avhVoucherId,
        avhAccYear: live.avhAccYear,
      },
    },
    data: {
      avhVoucherDate: bill.sbBillDatetime ?? bill.sbBillDate,
      avhUsrRefno: bill.sbUsrRefno,
      avhDocDate: bill.sbBillDate,
      avhDocAmount: billAmount,
      avhRoundOff: bill.sbRoundOff ?? 0,
      // ck_avh_balanced again — an edited total has to stay balanced.
      avhTotalDebit: billAmount,
      avhTotalCredit: billAmount,
      avhPartyId: bill.sbCustId,
      avhEmployeeId: bill.sbSalesmanId ?? [],
      avhRemarks: bill.sbRemarks,
      avhDeviceType: mapDeviceType(bill.sbDeviceType),
      avhDeviceId: bill.sbDeviceId,
      avhModifiedOn: now,
      avhModifiedBy: actor,
    },
  });
  return syncReceivable(tx, bill, live, vchrTypeId, actor, now, billAmount);
}
// Brings the acc_bills receivable in line with the edited bill, creating it if
// the bill only just acquired a value and retiring it if it lost one.
async function syncReceivable(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
  live: { avhVoucherId: string; avhAccYear: string },
  vchrTypeId: number,
  actor: string,
  now: Date,
  billAmount: Prisma.Decimal,
): Promise<string | null> {
  const existing = await tx.accBill.findFirst({
    where: {
      ablVoucherId: live.avhVoucherId,
      ablAccYear: live.avhAccYear,
      ablIsDeleted: false,
    },
    select: {
      ablId: true,
      ablAllocAmount: true,
      ablDiscAmount: true,
      ablWriteoffAmount: true,
    },
  });
  // ck_abl_amount insists a receivable is positive, so a bill edited down to
  // nothing has to give its receivable up rather than carry a zero one.
  if (billAmount.lessThanOrEqualTo(0)) {
    if (existing) {
      ensureNothingSettled(existing, billAmount);
      await retireReceivable(tx, existing.ablId, actor, now);
    }
    return null;
  }
  if (!existing) {
    return createReceivable(tx, bill, live, vchrTypeId, actor, now, billAmount);
  }
  ensureNothingSettled(existing, billAmount);
  await tx.accBill.update({
    where: { ablId: existing.ablId },
    data: {
      ablPartyId: bill.sbCustId,
      ablSalesmanId: bill.sbSalesmanId?.[0] ?? null,
      ablAgentId: bill.sbAgentId,
      ablDocDate: bill.sbBillDate,
      ablDocRefno: bill.sbUsrRefno?.slice(0, BILL_DOC_REFNO_MAX_LENGTH) ?? null,
      ablBillDate: bill.sbBillDate,
      ablDueDate: bill.sbDueDate,
      ablCreditDays: bill.sbDueDays ?? 0,
      ablBillAmount: billAmount,
      ablNarration: bill.sbRemarks,
      ablModifiedOn: now,
      ablModifiedBy: actor,
      ...(await resolveAllocation(tx, bill, existing.ablId, billAmount)),
    },
  });
  return existing.ablId;
}
// Cash bills settle themselves: the tendered amount is seeded into
// abl_alloc_amount at post time rather than through an adjustment, so while
// nothing has been adjusted against the bill an edited tender has to move the
// allocation with it — otherwise a corrected cash bill keeps the old figure
// outstanding.
//
// Once a real adjustment exists, abl_alloc_amount belongs to
// AccBillAdjustment and writing it here would silently wipe a receipt that has
// already been allocated. So this answers an empty patch and leaves it alone.
async function resolveAllocation(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
  ablId: string,
  billAmount: Prisma.Decimal,
): Promise<{ ablAllocAmount?: Prisma.Decimal }> {
  const adjustments = await tx.accBillAdjustment.count({
    where: { abaBillId: ablId, abaIsDeleted: false },
  });
  if (adjustments > 0) {
    return {};
  }
  const paid = bill.sbPaidAmt ?? new Prisma.Decimal(0);
  // ck_abl_settled: allocation can never exceed the bill. Overpayment lives on
  // the tender, not here.
  return { ablAllocAmount: paid.greaterThan(billAmount) ? billAmount : paid };
}
// Creates the receivable for a bill that had none — a posted bill edited up
// from zero, whose original post skipped acc_bills.
async function createReceivable(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
  live: { avhVoucherId: string; avhAccYear: string },
  vchrTypeId: number,
  actor: string,
  now: Date,
  billAmount: Prisma.Decimal,
): Promise<string> {
  if (bill.sbBillSlno === null || !bill.sbBillRefno) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be posted', [
      {
        field: 'sbStatus',
        message: 'A POSTED bill must have a bill number (sbBillSlno / sbBillRefno) assigned.',
      },
    ]);
  }
  const paid = bill.sbPaidAmt ?? new Prisma.Decimal(0);
  const created = await tx.accBill.create({
    data: {
      ablCompanyId: bill.sbCompanyId,
      ablBranchId: bill.sbBranchId,
      ablTenantId: bill.sbTenantId,
      ablAccYear: bill.sbAccYear,
      ablPartyId: bill.sbCustId,
      ablSalesmanId: bill.sbSalesmanId?.[0] ?? null,
      ablAgentId: bill.sbAgentId,
      ablBillType: BILL_REF_TYPE,
      ablVoucherId: live.avhVoucherId,
      ablVoucherTypeId: vchrTypeId,
      ablVoucherNo: bill.sbBillSlno,
      ablDocDate: bill.sbBillDate,
      ablDocRefno: bill.sbUsrRefno?.slice(0, BILL_DOC_REFNO_MAX_LENGTH) ?? null,
      ablBillRefno: bill.sbBillRefno,
      ablBillDate: bill.sbBillDate,
      ablDueDate: bill.sbDueDate,
      ablCreditDays: bill.sbDueDays ?? 0,
      ablDrCr: BILL_DR_CR,
      ablBillAmount: billAmount,
      ablAllocAmount: paid.greaterThan(billAmount) ? billAmount : paid,
      ablNarration: bill.sbRemarks,
      ablCreatedOn: now,
      ablCreatedBy: actor,
    },
    select: { ablId: true },
  });
  return created.ablId;
}
// ck_abl_settled would reject this at the database with a bare 23514, so the
// same rule is checked here to name the field that is actually wrong.
function ensureNothingSettled(
  existing: {
    ablAllocAmount: Prisma.Decimal;
    ablDiscAmount: Prisma.Decimal;
    ablWriteoffAmount: Prisma.Decimal;
  },
  billAmount: Prisma.Decimal,
): void {
  const settled = existing.ablAllocAmount
    .plus(existing.ablDiscAmount)
    .plus(existing.ablWriteoffAmount);
  if (settled.greaterThan(billAmount)) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be updated', [
      {
        field: 'sbBillAmt',
        message:
          `This bill already has ${settled.toString()} settled against it, so it cannot be ` +
          `changed to ${billAmount.toString()}. Reverse the settlement first.`,
      },
    ]);
  }
}
async function retireReceivable(
  tx: Prisma.TransactionClient,
  ablId: string,
  actor: string,
  now: Date,
): Promise<void> {
  // Soft delete rather than a hard one: ux_abl_bill_refno skips deleted rows,
  // so the bill's refno is freed while the row stays for audit.
  await tx.accBill.update({
    where: { ablId },
    data: {
      ablIsActive: false,
      ablIsDeleted: true,
      ablModifiedOn: now,
      ablModifiedBy: actor,
    },
  });
}
// Takes the bill back out of the books. The voucher is cancelled rather than
// deleted so the number it consumed stays consumed and the audit trail holds.
async function cancelPostedVoucher(
  tx: Prisma.TransactionClient,
  bill: BillPostingSource,
  live: { avhVoucherId: string; avhAccYear: string },
  actor: string,
  now: Date,
): Promise<void> {
  const receivable = await tx.accBill.findFirst({
    where: {
      ablVoucherId: live.avhVoucherId,
      ablAccYear: live.avhAccYear,
      ablIsDeleted: false,
    },
    select: {
      ablId: true,
      ablAllocAmount: true,
      ablDiscAmount: true,
      ablWriteoffAmount: true,
    },
  });
  if (receivable) {
    // Nothing may have been settled against a bill that is being unposted —
    // that money would otherwise point at a voucher that no longer exists.
    ensureNothingSettled(receivable, new Prisma.Decimal(0));
    await retireReceivable(tx, receivable.ablId, actor, now);
  }
  await tx.accVoucherHeader.update({
    where: {
      avhVoucherId_avhAccYear: {
        avhVoucherId: live.avhVoucherId,
        avhAccYear: live.avhAccYear,
      },
    },
    data: {
      avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
      // ck_avh_cancel: a cancellation must say why.
      avhCancelReason: (bill.sbCancelReason ?? DEFAULT_CANCEL_REASON).slice(
        0,
        CANCEL_REASON_MAX_LENGTH,
      ),
      // ck_avh_status_on: anything past DRAFT must say when and by whom.
      avhStatusOn: now,
      avhStatusBy: bill.sbUserId,
      avhModifiedOn: now,
      avhModifiedBy: actor,
    },
  });
}
// Next company-wide voucher serial for the financial year. Taken under an
// advisory lock held for the rest of the transaction, mirroring
// allocateVoucherNumber's approach to acc_voucher_seq.
async function allocateVoucherSlno(
  tx: Prisma.TransactionClient,
  companyId: string,
  accYear: string,
): Promise<bigint> {
  const lockKey = [companyId, accYear].join('|');
  await tx.$queryRaw`
    WITH advisory_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtext(${VOUCHER_SLNO_LOCK_NAMESPACE}),
        hashtext(${lockKey})
      )
    )
    SELECT 1::int AS locked
  `;
  const rows = await tx.$queryRaw<Array<{ next_slno: bigint }>>`
    SELECT COALESCE(MAX(avh_voucher_slno), 0) + 1 AS next_slno
    FROM accounts.acc_voucher_header
    WHERE avh_company_id = ${companyId}::uuid
      AND avh_acc_year = ${accYear}
  `;
  return rows[0]?.next_slno ?? BigInt(1);
}
function mapDeviceType(deviceType: string | null | undefined): string | null {
  const key = deviceType?.trim().toUpperCase();
  if (!key) {
    return null;
  }
  return DEVICE_TYPE_MAP[key] ?? null;
}
