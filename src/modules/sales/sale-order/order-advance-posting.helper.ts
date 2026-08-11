import { Prisma } from '@prisma/client';
import { throwSalesBadRequest } from 'src/common/utils/module-service.utils';
import {
  allocateVoucherNumber,
  allocateVoucherSlno,
} from 'src/common/Sequence/voucher-sequence.helper';
import { SaleOrderErrorDetail, SaleOrderErrorResponse } from './types/sale-order-api.types';
import { cancelOrderPdcRegister, syncOrderPdcRegister } from './order-pdc-posting.helper';
// accounts.acc_voucher_types row "ARc" / Order Advance Receipt, seeded by
// prisma/seed/Acc_Voucher_Types_Order_Advance_Receipt.sql.
//
// Deliberately NOT voucher type 4 (SOr / Sales Order): that type is
// vchr_category = INVENTORY with vchr_affects_accounts = false, because an order
// is a commitment and nothing about it belongs in the ledgers. The money the
// customer hands over against it is a different fact — a RECEIPT — and gets its
// own type, its own number series (arc00001, arc00002, ...) and its own row in
// the day book.
export const ORDER_ADVANCE_VCHR_TYPE_ID = 5;
// ck_avh_src wants all three src_* columns or none, and ux_avh_src makes
// (company, module, doc_type, doc_id, acc_year) unique — which is what stops the
// same order raising two advance receipts. Same pair the order's tender rows
// carry in acc_tender_detail (td_src_module / td_src_doc_type).
const ORDER_SRC_MODULE = 'SALES';
const ORDER_SRC_DOC_TYPE = 'SALES_ORDER';
// ck_av_dr_cr values. Money in: the tender ledger (cash / bank / card clearing)
// is debited, the advance-liability ledger is credited.
const DR = 'DR';
const CR = 'CR';
// ck_avh_status values this helper writes.
const VOUCHER_STATUS_POSTED = 'POSTED';
const VOUCHER_STATUS_CANCELLED = 'CANCELLED';
// sale_order.so_status that means the order is off — its advance receipt must
// not stay live in the books.
const ORDER_STATUS_CANCELLED = 'CANCELLED';
// ck_avh_cancel demands a reason on every cancellation (MCA Rule 3(1) audit
// trail). sale_order carries no cancellation column of its own — the reason
// lives in public.txn_status_log — so the two paths fall back to these.
const UNPOST_CANCEL_REASON = 'Sale order no longer holds tendered money';
const DELETE_CANCEL_REASON = 'Sale order deleted';
const CANCEL_REASON_MAX_LENGTH = 250;
// acc_vouchers.av_voucher_refno is VarChar(50); acc_tender_detail.td_ref_no,
// which feeds the per-line narration, is VarChar(100).
const VOUCHER_REFNO_MAX_LENGTH = 50;
// acc_bill_balance.abl_bill_type (ck_abl_bill_type): money received with no bill
// behind it yet, which is exactly what an order advance is. The party is in
// CREDIT for it (ck_abl_dr_cr: DR = receivable, CR = payable) — the company
// holds the customer's money and owes goods for it, the opposite of an invoice.
const ADVANCE_BILL_TYPE = 'ADVANCE';
const ADVANCE_BILL_DR_CR = 'CR';
// acc_bill_balance.abl_doc_refno is VarChar(100).
const BILL_REFNO_MAX_LENGTH = 100;
const ZERO = new Prisma.Decimal(0);
/// Identifies the order in accounts. Everything keyed off the source document
/// (ux_avh_src) needs only these three columns, so the delete path can run from
/// the stored row without assembling a whole OrderAdvancePostingSource.
export interface OrderAdvancePostingRef {
  soId: string;
  soCompanyId: string;
  soAccYear: string;
}
/// The subset of a SaleOrder row this helper needs. Declared structurally rather
/// than as the Prisma model so callers can pass the row straight through without
/// a cast.
export interface OrderAdvancePostingSource extends OrderAdvancePostingRef {
  soBranchId: string;
  soTenantId: string | null;
  soOrderRefno: string;
  soUsrRefno: string | null;
  soOrderDate: Date;
  soOrderDatetime: Date;
  // Only the cheque register reads this — it is the drawer's name, and nothing
  // in acc_tender_detail says who signed the instrument.
  soCustName: string;
  // The order's own value and rounding. These are the DOCUMENT's face
  // (avh_doc_amount / avh_round_off) — what the order is worth — and are
  // deliberately NOT the voucher's debit/credit totals, which are what the
  // customer actually handed over. A ₹10,000 order with a ₹2,000 advance posts
  // doc_amount 10000 and totals 2000.
  soOrderAmt: Prisma.Decimal;
  soRoundOff: Prisma.Decimal | null;
  soCustId: string;
  // The customer-advance LIABILITY ledger. Money taken before delivery is not a
  // reduction of a receivable — nothing is owed yet — so it is credited here
  // when the order names one. Falls back to the customer's own ledger, which
  // shares the customer's primary key.
  soAdvanceLedgerId: string | null;
  // The advance roll-ups, which is what the outstanding row in
  // accounts.acc_bill_balance is made of: so_advance_recd_amt is the bill's face
  // (what the customer handed over) and the other three are what has since been
  // used up against it. See syncAdvanceBill.
  soAdvanceRecdAmt: Prisma.Decimal;
  soAdvanceAdjustedAmt: Prisma.Decimal;
  soAdvanceRefundAmt: Prisma.Decimal;
  soAdvanceForfeitAmt: Prisma.Decimal;
  soSalesmanId: string[];
  soAgentId: string | null;
  soUserId: string;
  soSessionId: string | null;
  soDeviceId: string;
  soRemarks: string | null;
  // Drives the sync path: a CANCELLED order must not keep a live receipt.
  soStatus: string;
}
/// One acc_tender_detail row of the order, as far as the books care.
export interface OrderAdvanceTenderLine {
  tdId: string;
  tdRowNo: number;
  tdTenderId: string;
  // accounts.acc_tender_types.ttm_type_id. The ledgers do not care which it is —
  // money is money — but type 5 (CHEQUE) also opens a row in the cheque
  // register, so the line carries it.
  tdTenderTypeId: number;
  // The cash / bank / card-clearing ledger the money landed in.
  tdTenderLedgerId: string;
  tdAmount: Prisma.Decimal;
  tdSurchargeAmt: Prisma.Decimal;
  // Income ledger snapshotted from the tender master when the line was
  // captured; null on a line that snapshotted none, in which case the master is
  // read at posting time (see resolveSurchargeLedgers).
  tdSurchargeLedgerId: string | null;
  // ck_td_total_amt keeps this equal to round(amount + surcharge, 2), so it is
  // what actually hits the tender ledger.
  tdTotalAmt: Prisma.Decimal;
  tdRefNo: string | null;
  tdNotes: string | null;
  // Instrument columns — read only by the cheque register (see
  // order-pdc-posting.helper.ts).
  tdInstrumentDate: Date | null;
  tdBankName: string | null;
  tdSettleLedgerId: string | null;
}
export interface OrderAdvancePostingResult {
  // accounts.acc_voucher_header.avh_voucher_id — also stamped onto every tender
  // row's acc_tender_detail.td_voucher_id.
  voucherId: string;
  voucherNo: bigint;
  voucherRefno: string;
  // accounts.acc_vouchers.av_id of the ledger lines, in row order.
  lineIds: string[];
  // accounts.acc_bill_balance.abl_id of the ADVANCE outstanding row, or null
  // when the order holds nothing for the customer.
  billId: string | null;
  // accounts.acc_pdc_register.apd_id, one per cheque tender (type 5); empty
  // when the money came in some other way.
  pdcIds: string[];
  // Sum of td_total_amt: both sides of the voucher.
  totalAmount: Prisma.Decimal;
  postedOn: Date;
}
/// Posts an order's tendered money into accounts: one acc_voucher_header
/// (a POSTED receipt) plus the acc_vouchers double-entry lines behind it, the
/// acc_bill_balance ADVANCE row the money leaves outstanding, an
/// acc_pdc_register row per cheque tendered (tender type 5), and stamps the new
/// voucher id back onto the tender rows.
///
/// The two tables are filled from two different sources, on purpose:
///   * acc_voucher_header comes from the SALE ORDER — its scope (company /
///     branch / tenant / year), its number and date, its customer, salesmen,
///     device, user and session, and its doc_* face (refno, date, value,
///     rounding). The order is what the voucher is ABOUT.
///   * acc_vouchers comes from the TENDER DETAIL rows — one entry per tender,
///     each naming the ledger the money landed in and the amount. The tenders
///     are what the voucher DOES.
/// The header's avh_voucher_id, returned by the insert, is what ties the second
/// to the first (av_voucher_id + av_acc_year → the header's composite PK).
///
/// Per tender row the entry is
///   DR  tender ledger        td_total_amt
///     CR  advance ledger       td_amount
///     CR  surcharge ledger     td_surcharge_amt   (only when there is one)
/// so the voucher balances row by row, not just in total.
///
/// Must run inside the caller's transaction so the accounting rows commit with
/// the order and its tenders — an order holding money with no voucher behind it
/// is exactly the inconsistency this prevents.
export async function postOrderAdvanceToAccounts(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingSource,
  tenders: OrderAdvanceTenderLine[],
  actor: string,
  postedOn: Date,
): Promise<OrderAdvancePostingResult> {
  const postable = toPostableTenders(tenders);
  const creditLedgerId = resolveCreditLedgerId(order);
  const surchargeLedgers = await resolveSurchargeLedgers(tx, postable);
  ensureLedgersDiffer(postable, creditLedgerId, surchargeLedgers);
  const totalAmount = sumTotals(postable);
  const voucherDate = order.soOrderDatetime ?? order.soOrderDate;
  // avh_voucher_no runs per voucher type (its own arc… series, drawn from
  // acc_voucher_seq); avh_voucher_slno runs across every type in the company and
  // year. ck_avh_no demands both on anything past DRAFT.
  const voucherNumber = await allocateVoucherNumber(tx, {
    vchrTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
    companyId: order.soCompanyId,
    branchId: order.soBranchId,
    accYear: order.soAccYear,
    documentDate: order.soOrderDate,
  });
  const voucherSlno = await allocateVoucherSlno(tx, order.soCompanyId, order.soAccYear);
  const header = await tx.accVoucherHeader.create({
    data: {
      avhCompanyId: order.soCompanyId,
      avhBranchId: order.soBranchId,
      avhTenantId: order.soTenantId,
      avhAccYear: order.soAccYear,
      avhVoucherTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
      avhVoucherNo: voucherNumber.lastNo,
      avhVoucherSlno: voucherSlno,
      avhVoucherRefno: voucherNumber.refno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
      avhVoucherDate: voucherDate,
      // The receipt's source document is the ORDER, so the order can always be
      // found from the voucher and vice versa (ux_avh_src).
      avhSrcModule: ORDER_SRC_MODULE,
      avhSrcDocType: ORDER_SRC_DOC_TYPE,
      avhSrcDocId: order.soId,
      avhUsrRefno: order.soUsrRefno,
      avhDocRefno: order.soOrderRefno,
      avhDocDate: order.soOrderDate,
      // The doc_* block is the ORDER: its refno, its date, its value, its
      // rounding. ck_avh_amounts only asks that they are not negative.
      avhDocAmount: order.soOrderAmt ?? ZERO,
      avhRoundOff: order.soRoundOff ?? ZERO,
      // The totals, by contrast, are what the RECEIPT moves — the tendered
      // money. ck_avh_balanced: a POSTED voucher must balance, and it does —
      // every rupee debited to a tender ledger is credited to the advance or
      // surcharge ledger.
      avhTotalDebit: totalAmount,
      avhTotalCredit: totalAmount,
      // Customer and ledger share a primary key, so soCustId is already the
      // acc_ledger_master id.
      avhPartyId: order.soCustId,
      // Unlike a bill, this voucher HAS a single contra side: whatever the
      // tender ledgers were debited to.
      avhOppositeLedgerId: creditLedgerId,
      // Scalar list — Prisma rejects null here.
      avhEmployeeId: order.soSalesmanId ?? [],
      avhRemarks: order.soRemarks,
      avhVoucherStatus: VOUCHER_STATUS_POSTED,
      // ck_avh_status_on / ck_avh_posted_on: anything past DRAFT must say when
      // and by whom, and POSTED must carry a posted-on.
      avhStatusOn: postedOn,
      avhStatusBy: order.soUserId,
      avhPostedOn: postedOn,
      avhUserId: order.soUserId,
      avhSessionId: order.soSessionId,
      // sale_order keys its device by id (fixed.device_master) and stores no
      // device TYPE, so ck_avh_device_type's value set has nothing to map from.
      avhDeviceType: null,
      avhDeviceId: order.soDeviceId,
      avhCreatedOn: postedOn,
      avhCreatedBy: actor,
    },
    select: { avhVoucherId: true },
  });
  const lineIds = await writeVoucherLines(tx, {
    order,
    tenders: postable,
    creditLedgerId,
    surchargeLedgers,
    voucherId: header.avhVoucherId,
    voucherNo: voucherNumber.lastNo,
    voucherRefno: voucherNumber.refno,
    voucherDate,
    actor,
    now: postedOn,
  });
  await stampTenderVoucher(tx, order, header.avhVoucherId);
  // A cheque is not only money: it is an instrument the company now holds and
  // must deposit, chase and, if it bounces, reopen. That life is the cheque
  // register's, so every type 5 tender opens a row there alongside the receipt.
  const pdcIds = await syncOrderPdcRegister(
    tx,
    order,
    postable,
    { voucherId: header.avhVoucherId, accYear: order.soAccYear },
    actor,
    postedOn,
  );
  // The ledgers now say the money came in; the outstanding says the customer is
  // holding a credit with us until an invoice eats it.
  const billId = await syncAdvanceBill(
    tx,
    order,
    {
      voucherId: header.avhVoucherId,
      voucherNo: voucherNumber.lastNo,
      voucherRefno: voucherNumber.refno,
      voucherDate,
    },
    resolveAdvanceHeld(order, postable),
    actor,
    postedOn,
  );
  return {
    voucherId: header.avhVoucherId,
    voucherNo: voucherNumber.lastNo,
    voucherRefno: voucherNumber.refno,
    lineIds,
    billId,
    pdcIds,
    totalAmount,
    postedOn,
  };
}
/// What syncOrderAdvancePosting did to the books.
///   created   — the order's advance entered the books
///   updated   — an already-posted receipt was re-synced to the edited tenders
///   cancelled — the money went away (or the order did); the receipt is CANCELLED
///   unchanged — there was nothing to post before and nothing now
export type OrderAdvancePostingAction = 'created' | 'updated' | 'cancelled' | 'unchanged';
export interface OrderAdvancePostingSyncResult {
  action: OrderAdvancePostingAction;
  // All null once the order no longer carries a live receipt.
  voucherId: string | null;
  // The ADVANCE outstanding row. Null even on a live receipt when the order
  // holds nothing — a tender that was pure surcharge leaves the customer no
  // credit, and ck_abl_amount refuses a zero-value bill.
  billId: string | null;
  // The cheque-register rows the order now holds ('created' / 'updated'), or
  // the ones it just gave up ('cancelled'). Empty when no cheque was tendered.
  pdcIds: string[];
  totalAmount: Prisma.Decimal | null;
  postedOn: Date | null;
}
/// Brings accounts in line with an order that has just been created or updated.
///
/// The inputs are the order's own status and its live tender rows: money on a
/// live order means accounts must carry a receipt, no money — or a CANCELLED
/// order — means it must not. That covers every transition the save path can
/// produce without the caller comparing before/after itself.
///
/// Deliberately keyed off the source document (ux_avh_src) rather than any
/// client-writable column, so a payload cannot point an order at someone else's
/// voucher.
///
/// Must run inside the caller's transaction, for the same reason as
/// postOrderAdvanceToAccounts.
export async function syncOrderAdvancePosting(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingSource,
  tenders: OrderAdvanceTenderLine[],
  actor: string,
  now: Date,
): Promise<OrderAdvancePostingSyncResult> {
  const live = await findLiveVoucher(tx, order);
  const postable = toPostableTenders(tenders);
  const shouldPost = order.soStatus !== ORDER_STATUS_CANCELLED && postable.length > 0;
  if (shouldPost) {
    if (live) {
      const resynced = await resyncPostedVoucher(tx, order, postable, live, actor, now);
      return {
        action: 'updated',
        voucherId: live.avhVoucherId,
        billId: resynced.billId,
        pdcIds: resynced.pdcIds,
        totalAmount: resynced.totalAmount,
        postedOn: live.avhPostedOn,
      };
    }
    // No live voucher, but a cancelled one may still hold this order's voucher
    // number: ux_avh_voucher_no only excludes DRAFT and deleted rows, so
    // re-posting would collide on it. Answer 400 rather than a raw 23505.
    await ensureNotPreviouslyCancelled(tx, order);
    const created = await postOrderAdvanceToAccounts(tx, order, postable, actor, now);
    return {
      action: 'created',
      voucherId: created.voucherId,
      billId: created.billId,
      pdcIds: created.pdcIds,
      totalAmount: created.totalAmount,
      postedOn: created.postedOn,
    };
  }
  if (live) {
    const pdcIds = await cancelPostedVoucher(tx, order, live, UNPOST_CANCEL_REASON, actor, now);
    return {
      action: 'cancelled',
      voucherId: null,
      billId: null,
      pdcIds,
      totalAmount: null,
      postedOn: null,
    };
  }
  // Nothing before and nothing now: the outstanding row cannot exist either,
  // since it only ever lives alongside a receipt and goes with it when the
  // receipt is cancelled — and no cheque can be registered without one.
  return {
    action: 'unchanged',
    voucherId: null,
    billId: null,
    pdcIds: [],
    totalAmount: null,
    postedOn: null,
  };
}
/// What deleteOrderAdvancePosting took out of the books.
export interface OrderAdvancePostingDeleteResult {
  // The vouchers that were soft-deleted — empty when the order never held money.
  voucherIds: string[];
  // The ADVANCE outstanding rows that went with them.
  billIds: string[];
  // ... and the cheque-register rows, cancelled and retired with the order.
  pdcIds: string[];
}
/// Takes a soft-deleted order's accounting rows out of the books: the receipt
/// raised for it, its acc_vouchers ledger lines, the acc_bill_balance ADVANCE
/// row it left outstanding and any acc_pdc_register cheque it took in are all
/// flagged deleted.
///
/// Differs from syncOrderAdvancePosting's cancel branch on purpose: unposting an
/// order that still exists only CANCELS the receipt (the number stays consumed,
/// and the cancelled row goes on blocking a re-post), whereas deleting the order
/// retires the rows that pointed at it — nothing may keep referencing a document
/// that is gone.
///
/// Must run inside the caller's transaction so the books and the order go at the
/// same moment.
export async function deleteOrderAdvancePosting(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingRef,
  actor: string,
  now: Date,
): Promise<OrderAdvancePostingDeleteResult> {
  // Normally at most one. Cancelled headers are included: a cancelled receipt
  // only outlives its order while the order is still there to take money again.
  const headers = await tx.accVoucherHeader.findMany({
    where: {
      avhCompanyId: order.soCompanyId,
      avhAccYear: order.soAccYear,
      avhSrcModule: ORDER_SRC_MODULE,
      avhSrcDocType: ORDER_SRC_DOC_TYPE,
      avhSrcDocId: order.soId,
      avhIsDeleted: false,
    },
    select: { avhVoucherId: true, avhAccYear: true },
  });
  // Keyed by the ORDER, not by the voucher: the outstanding row names its
  // source document directly (ix_abl_src_doc), so it is retired once whichever
  // receipt it was raised through.
  const billIds = await retireAdvanceBill(tx, order, actor, now);
  // The instruments go the same way, keyed off the order's tender rows — which
  // the caller has soft deleted by now, so they are looked up regardless of that
  // flag. A cheque already at the bank refuses, before anything else is undone.
  const pdcIds = await cancelOrderPdcRegister(tx, order, 'deleted', null, actor, now);
  const voucherIds: string[] = [];
  for (const header of headers) {
    await retireVoucherLines(tx, header, actor, now);
    await tx.accVoucherHeader.update({
      where: {
        avhVoucherId_avhAccYear: {
          avhVoucherId: header.avhVoucherId,
          avhAccYear: header.avhAccYear,
        },
      },
      data: {
        // Deleted and cancelled: a row left saying POSTED would still be read as
        // live by anything that filters on status rather than the flag.
        avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
        // ck_avh_cancel / ck_avh_status_on.
        avhCancelReason: DELETE_CANCEL_REASON,
        avhStatusOn: now,
        avhStatusBy: actor,
        avhIsActive: false,
        avhIsDeleted: true,
        avhModifiedOn: now,
        avhModifiedBy: actor,
      },
    });
    voucherIds.push(header.avhVoucherId);
  }
  // The tender rows are soft deleted by the caller; clearing the pointer keeps a
  // deleted voucher from being read back off them.
  await clearTenderVoucher(tx, order);
  return { voucherIds, billIds, pdcIds };
}
// ── internals ──────────────────────────────────────────────────────────────
// The tender rows that can actually be posted. ck_av_amount insists every
// ledger line is positive, so a zero-value tender (a fully-discounted loyalty
// redemption, say) contributes nothing and is dropped rather than failing the
// save. Row order is the voucher's line order.
function toPostableTenders(tenders: OrderAdvanceTenderLine[]): OrderAdvanceTenderLine[] {
  return tenders
    .filter((tender) => (tender.tdTotalAmt ?? ZERO).greaterThan(0))
    .sort((left, right) => left.tdRowNo - right.tdRowNo);
}
function sumTotals(tenders: OrderAdvanceTenderLine[]): Prisma.Decimal {
  return tenders.reduce((total, tender) => total.plus(tender.tdTotalAmt ?? ZERO), ZERO);
}
// Decimal columns come back from Prisma as Decimal, but the arithmetic below
// compares and subtracts them, so anything a caller hands over as a plain number
// is brought onto the same footing rather than blowing up on .greaterThan.
function toDecimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  return value === null || value === undefined ? ZERO : new Prisma.Decimal(value);
}
// What the order is HOLDING for the customer, which is what the outstanding row
// is worth.
//
// The order's own roll-up wins: so_advance_recd_amt is the money side of the
// header and is what every advance screen and the ck_so_advance_balance equation
// are stated in. When the payload leaves it at zero the tenders stand in — their
// td_amount, deliberately WITHOUT the surcharge, which is the company's income
// and never the customer's credit.
function resolveAdvanceHeld(
  order: OrderAdvancePostingSource,
  tenders: OrderAdvanceTenderLine[],
): Prisma.Decimal {
  const stated = toDecimal(order.soAdvanceRecdAmt);
  if (stated.greaterThan(0)) {
    return stated;
  }
  return tenders.reduce((total, tender) => total.plus(toDecimal(tender.tdAmount)), ZERO);
}
function resolveCreditLedgerId(order: OrderAdvancePostingSource): string {
  return order.soAdvanceLedgerId ?? order.soCustId;
}
// Surcharge is the customer paying for the privilege of a card / gateway; it is
// income, not part of the advance, so it is credited to the tender's own
// surcharge ledger. The line's own snapshot (td_surcharge_ledger_id) wins —
// that is what the operator tendered against — and the tender master
// (tnd_surcharge_ledger_id) answers for a line that carries none. A tender that
// charges a surcharge without either cannot be posted.
async function resolveSurchargeLedgers(
  tx: Prisma.TransactionClient,
  tenders: OrderAdvanceTenderLine[],
): Promise<Map<string, string>> {
  const surcharged = tenders.filter((tender) => (tender.tdSurchargeAmt ?? ZERO).greaterThan(0));
  if (surcharged.length === 0) {
    return new Map();
  }
  const masters = await tx.accTenderMaster.findMany({
    where: { tndId: { in: [...new Set(surcharged.map((tender) => tender.tdTenderId))] } },
    select: { tndId: true, tndName: true, tndSurchargeLedgerId: true },
  });
  const byId = new Map(masters.map((master) => [master.tndId, master]));
  const ledgers = new Map<string, string>();
  for (const tender of surcharged) {
    const ledgerId = tender.tdSurchargeLedgerId ?? byId.get(tender.tdTenderId)?.tndSurchargeLedgerId;
    if (!ledgerId) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Order advance cannot be posted',
        [
          {
            field: 'tenders',
            message:
              `Tender line ${tender.tdRowNo} (${byId.get(tender.tdTenderId)?.tndName ?? 'unknown tender'}) ` +
              'charges a surcharge but neither the line nor its tender master names a surcharge ledger, ' +
              'so the receipt cannot be posted.',
          },
        ],
      );
    }
    ledgers.set(tender.tdId, ledgerId);
  }
  return ledgers;
}
// ck_av_self rejects a line whose ledger and opposite ledger are the same, which
// is what a tender paid into the very ledger being credited would produce. The
// database would answer a bare 23514, so the same rule is checked here to name
// the line that is actually wrong.
function ensureLedgersDiffer(
  tenders: OrderAdvanceTenderLine[],
  creditLedgerId: string,
  surchargeLedgers: Map<string, string>,
): void {
  for (const tender of tenders) {
    const clash =
      tender.tdTenderLedgerId === creditLedgerId ||
      surchargeLedgers.get(tender.tdId) === tender.tdTenderLedgerId;
    if (clash) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Order advance cannot be posted',
        [
          {
            field: 'tenders',
            message:
              `Tender line ${tender.tdRowNo} pays into the same ledger it would be credited to, ` +
              'so it has no entry to make. Point the tender or the advance ledger somewhere else.',
          },
        ],
      );
    }
  }
}
// The double-entry lines, numbered from 1 across the whole voucher.
// ux_av_voucher_row makes (voucher, acc_year, row_no) unique among live rows.
async function writeVoucherLines(
  tx: Prisma.TransactionClient,
  context: {
    order: OrderAdvancePostingSource;
    tenders: OrderAdvanceTenderLine[];
    creditLedgerId: string;
    surchargeLedgers: Map<string, string>;
    voucherId: string;
    voucherNo: bigint;
    voucherRefno: string;
    voucherDate: Date;
    actor: string;
    now: Date;
  },
): Promise<string[]> {
  const { order, creditLedgerId, surchargeLedgers } = context;
  const lineIds: string[] = [];
  let rowNo = 0;
  const addLine = async (line: {
    drCr: string;
    ledgerId: string;
    oppLedgerId: string;
    amount: Prisma.Decimal;
    remarks: string | null;
  }): Promise<void> => {
    rowNo += 1;
    const created = await tx.accVoucher.create({
      data: {
        avVoucherId: context.voucherId,
        avCompanyId: order.soCompanyId,
        avBranchId: order.soBranchId,
        avTenantId: order.soTenantId,
        avAccYear: order.soAccYear,
        avVoucherTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
        avVoucherNo: context.voucherNo,
        avRowNo: rowNo,
        avVoucherDate: context.voucherDate,
        avVoucherRefno: context.voucherRefno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
        // The order is the document behind the line. av_doc_id is left alone —
        // fk_av_doc points at acc_bills_balance, and an advance settles no bill.
        avDocDate: order.soOrderDate,
        avDocRefno: order.soOrderRefno,
        avDrCr: line.drCr,
        avLedgerId: line.ledgerId,
        avOppLedgerId: line.oppLedgerId,
        avAmount: line.amount,
        // av_signed_amount and av_is_reconciled are GENERATED ALWAYS columns —
        // sending either would be rejected by Postgres.
        avRemarks: line.remarks,
        avSessionId: order.soSessionId,
        avUserId: order.soUserId,
        avCreatedOn: context.now,
        avCreatedBy: context.actor,
      },
      select: { avId: true },
    });
    lineIds.push(created.avId);
  };
  for (const tender of context.tenders) {
    const narration = describeTender(tender, order);
    const surchargeLedgerId = surchargeLedgers.get(tender.tdId);
    const surcharge = tender.tdSurchargeAmt ?? ZERO;
    await addLine({
      drCr: DR,
      ledgerId: tender.tdTenderLedgerId,
      oppLedgerId: creditLedgerId,
      amount: tender.tdTotalAmt,
      remarks: narration,
    });
    // The advance itself. A tender that is pure surcharge credits nothing here.
    if ((tender.tdAmount ?? ZERO).greaterThan(0)) {
      await addLine({
        drCr: CR,
        ledgerId: creditLedgerId,
        oppLedgerId: tender.tdTenderLedgerId,
        amount: tender.tdAmount,
        remarks: narration,
      });
    }
    if (surchargeLedgerId && surcharge.greaterThan(0)) {
      await addLine({
        drCr: CR,
        ledgerId: surchargeLedgerId,
        oppLedgerId: tender.tdTenderLedgerId,
        amount: surcharge,
        remarks: `Surcharge on ${narration}`,
      });
    }
  }
  return lineIds;
}
function describeTender(tender: OrderAdvanceTenderLine, order: OrderAdvancePostingSource): string {
  const reference = tender.tdRefNo ?? tender.tdNotes;
  return reference
    ? `Advance against order ${order.soOrderRefno} (${reference})`
    : `Advance against order ${order.soOrderRefno}`;
}
// The receipt this order is currently posted through, if any. Cancelled and
// deleted vouchers are not live — they are exactly what ux_avh_src excludes.
async function findLiveVoucher(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingRef,
): Promise<{
  avhVoucherId: string;
  avhAccYear: string;
  avhVoucherNo: bigint | null;
  avhVoucherRefno: string | null;
  avhVoucherDate: Date;
  avhPostedOn: Date | null;
} | null> {
  return tx.accVoucherHeader.findFirst({
    where: {
      avhCompanyId: order.soCompanyId,
      avhAccYear: order.soAccYear,
      avhSrcModule: ORDER_SRC_MODULE,
      avhSrcDocType: ORDER_SRC_DOC_TYPE,
      avhSrcDocId: order.soId,
      avhIsDeleted: false,
      avhVoucherStatus: { not: VOUCHER_STATUS_CANCELLED },
    },
    select: {
      avhVoucherId: true,
      avhAccYear: true,
      avhVoucherNo: true,
      avhVoucherRefno: true,
      avhVoucherDate: true,
      avhPostedOn: true,
    },
  });
}
// An order whose receipt was cancelled cannot go back into the books under the
// same voucher number — the cancelled row still owns it. Taking money again is a
// new receipt, which today means a new order.
async function ensureNotPreviouslyCancelled(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingRef,
): Promise<void> {
  const cancelled = await tx.accVoucherHeader.findFirst({
    where: {
      avhCompanyId: order.soCompanyId,
      avhAccYear: order.soAccYear,
      avhSrcModule: ORDER_SRC_MODULE,
      avhSrcDocType: ORDER_SRC_DOC_TYPE,
      avhSrcDocId: order.soId,
      avhIsDeleted: false,
      avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
    },
    select: { avhVoucherId: true },
  });
  if (cancelled) {
    throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      'Order advance cannot be posted',
      [
        {
          field: 'tenders',
          message:
            'This order already had an advance receipt posted and cancelled in accounts; it cannot be posted again. Raise the receipt separately instead.',
        },
      ],
    );
  }
}
// Re-syncs an already-posted receipt. The voucher's identity (number, refno,
// date, posted-on) is fixed at first post and deliberately left alone; the
// ledger lines are rebuilt from the current tenders, because a line is pure
// derived data and an edited tender changes both its amount and which ledger it
// belongs to.
async function resyncPostedVoucher(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingSource,
  tenders: OrderAdvanceTenderLine[],
  live: {
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherNo: bigint | null;
    avhVoucherRefno: string | null;
    avhVoucherDate: Date;
  },
  actor: string,
  now: Date,
): Promise<{ totalAmount: Prisma.Decimal; billId: string | null; pdcIds: string[] }> {
  const creditLedgerId = resolveCreditLedgerId(order);
  const surchargeLedgers = await resolveSurchargeLedgers(tx, tenders);
  ensureLedgersDiffer(tenders, creditLedgerId, surchargeLedgers);
  const totalAmount = sumTotals(tenders);
  await tx.accVoucherHeader.update({
    where: {
      avhVoucherId_avhAccYear: {
        avhVoucherId: live.avhVoucherId,
        avhAccYear: live.avhAccYear,
      },
    },
    data: {
      avhUsrRefno: order.soUsrRefno,
      avhDocRefno: order.soOrderRefno,
      avhDocDate: order.soOrderDate,
      // Re-read from the order, as on first post: an edited order value moves
      // the document's face, an edited tender moves the voucher's totals.
      avhDocAmount: order.soOrderAmt ?? ZERO,
      avhRoundOff: order.soRoundOff ?? ZERO,
      // ck_avh_balanced again — an edited total has to stay balanced.
      avhTotalDebit: totalAmount,
      avhTotalCredit: totalAmount,
      avhPartyId: order.soCustId,
      avhOppositeLedgerId: creditLedgerId,
      avhEmployeeId: order.soSalesmanId ?? [],
      avhRemarks: order.soRemarks,
      avhModifiedOn: now,
      avhModifiedBy: actor,
    },
  });
  // Retire first, insert second: ux_av_voucher_row skips deleted rows, so the
  // rebuilt lines can start again at row 1 without colliding with the old ones.
  await retireVoucherLines(tx, live, actor, now);
  await writeVoucherLines(tx, {
    order,
    tenders,
    creditLedgerId,
    surchargeLedgers,
    voucherId: live.avhVoucherId,
    // av_voucher_no is NOT NULL; a live (non-DRAFT) header always has one, and
    // ck_avh_no is what guarantees it.
    voucherNo: live.avhVoucherNo ?? BigInt(0),
    voucherRefno: live.avhVoucherRefno ?? order.soOrderRefno,
    voucherDate: live.avhVoucherDate,
    actor,
    now,
  });
  await stampTenderVoucher(tx, order, live.avhVoucherId);
  // The instruments follow the edit too: a cheque line added on this save is
  // registered now, an edited one re-synced, and one that is gone — or is no
  // longer a cheque — gives its register row up.
  const pdcIds = await syncOrderPdcRegister(
    tx,
    order,
    tenders,
    { voucherId: live.avhVoucherId, accYear: live.avhAccYear },
    actor,
    now,
  );
  // ... and the outstanding follows the edit the same way the lines do: an
  // order that took more money owes more back, one edited down to nothing gives
  // its outstanding row up.
  const billId = await syncAdvanceBill(
    tx,
    order,
    {
      voucherId: live.avhVoucherId,
      voucherNo: live.avhVoucherNo ?? BigInt(0),
      voucherRefno: live.avhVoucherRefno ?? order.soOrderRefno,
      voucherDate: live.avhVoucherDate,
    },
    resolveAdvanceHeld(order, tenders),
    actor,
    now,
  );
  return { totalAmount, billId, pdcIds };
}
// Takes the order back out of the books. The voucher is cancelled rather than
// deleted so the number it consumed stays consumed and the audit trail holds.
async function cancelPostedVoucher(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingSource,
  live: { avhVoucherId: string; avhAccYear: string },
  reason: string,
  actor: string,
  now: Date,
): Promise<string[]> {
  // The money is no longer held, so the customer's credit goes with it. Done
  // first: it refuses when something has already been settled against the
  // advance, and nothing should be half-unposted when it does.
  await retireAdvanceBill(tx, order, actor, now);
  // Same for the instruments, and for the same reason: a cheque the bank has
  // already seen refuses to go, and it must refuse before anything is undone.
  const pdcIds = await cancelOrderPdcRegister(tx, order, 'unposted', order.soUserId, actor, now);
  await retireVoucherLines(tx, live, actor, now);
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
      avhCancelReason: reason.slice(0, CANCEL_REASON_MAX_LENGTH),
      // ck_avh_status_on: anything past DRAFT must say when and by whom.
      avhStatusOn: now,
      avhStatusBy: order.soUserId,
      avhModifiedOn: now,
      avhModifiedBy: actor,
    },
  });
  await clearTenderVoucher(tx, order);
  return pdcIds;
}
// Soft delete rather than a hard one: ux_av_voucher_row skips deleted rows, so
// the line numbers are freed while the rows stay for audit.
async function retireVoucherLines(
  tx: Prisma.TransactionClient,
  header: { avhVoucherId: string; avhAccYear: string },
  actor: string,
  now: Date,
): Promise<void> {
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
}
// ── the ADVANCE outstanding row ────────────────────────────────────────────
// The receipt the outstanding row hangs off. ck_abl_voucher: everything except
// an OPENING balance must name the voucher that opened it AND that voucher's
// type, which is why this travels with every call.
interface AdvanceBillVoucher {
  voucherId: string;
  voucherNo: bigint;
  voucherRefno: string;
  voucherDate: Date;
}
// The stored outstanding row, as far as the guards care. acc_bill_balance is
// partitioned by abl_acc_year, so pk_acc_bill_balance is the pair and every
// write below has to carry the year as well as the id.
interface AdvanceBillRow {
  ablId: string;
  ablAccYear: string;
  ablDocRefno: string;
  ablAllocAmount: Prisma.Decimal;
  ablDiscAmount: Prisma.Decimal;
  ablWriteoffAmount: Prisma.Decimal;
}
/// Brings the accounts.acc_bill_balance ADVANCE row in line with the money the
/// order is holding: creates it when the order first takes an advance, moves it
/// when the advance changes, and gives it up when the advance goes.
///
/// This is the bill side of the same fact the receipt records. The voucher says
/// the money MOVED (tender ledger debited, advance ledger credited); the
/// outstanding row says the customer now has a CREDIT with us that no invoice
/// has eaten yet — which is what the ageing report, the adjustment screen and
/// the order's own advance panel read (ix_abl_src_doc). Without it the money is
/// in the ledgers but invisible to every "what does this party have with us"
/// question, since those are all asked of acc_bill_balance.
///
/// Unlike a sale bill's receivable, this one is a PAYABLE (abl_dr_cr = 'CR'):
/// an advance is the customer's money, held.
async function syncAdvanceBill(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingSource,
  voucher: AdvanceBillVoucher,
  amount: Prisma.Decimal,
  actor: string,
  now: Date,
): Promise<string | null> {
  const existing = await findAdvanceBill(tx, order);
  // ck_abl_amount insists a bill is worth something, so an order holding
  // nothing — a tender that was pure surcharge, or an advance edited down to
  // zero — gives its outstanding row up rather than carrying a zero one.
  if (!amount.greaterThan(0)) {
    if (existing) {
      await ensureAdvanceCanBeRetired(tx, existing);
      await retireBillRow(tx, existing, actor, now);
    }
    return null;
  }
  if (!existing) {
    return createAdvanceBill(tx, order, voucher, amount, actor, now);
  }
  ensureNothingSettledAgainstAdvance(existing, amount);
  await tx.accBillBalance.update({
    // acc_bill_balance is partitioned by abl_acc_year, so pk_acc_bill_balance
    // is the pair — the year the advance was taken in, which the row keeps for
    // life.
    where: { ablId_ablAccYear: { ablId: existing.ablId, ablAccYear: existing.ablAccYear } },
    data: {
      ablPartyId: order.soCustId,
      ablSalesmanId: order.soSalesmanId?.[0] ?? null,
      ablAgentId: order.soAgentId ?? null,
      ablDocDate: order.soOrderDate,
      ablVoucherId: voucher.voucherId,
      ablVoucherTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
      ablVoucherNo: voucher.voucherNo,
      ablVoucherDate: voucher.voucherDate,
      ablVoucherRefno: voucher.voucherRefno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
      ablBillAmount: amount,
      ablNarration: describeAdvance(order),
      ablModifiedOn: now,
      ablModifiedBy: actor,
      ...(await resolveAdvanceAllocation(tx, order, existing.ablId, amount)),
    },
  });
  return existing.ablId;
}
async function createAdvanceBill(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingSource,
  voucher: AdvanceBillVoucher,
  amount: Prisma.Decimal,
  actor: string,
  now: Date,
): Promise<string> {
  const created = await tx.accBillBalance.create({
    data: {
      ablCompanyId: order.soCompanyId,
      ablBranchId: order.soBranchId,
      ablTenantId: order.soTenantId,
      ablAccYear: order.soAccYear,
      // Customer and ledger share a primary key, so soCustId is already the
      // acc_ledger_master id fk_abl_party wants.
      ablPartyId: order.soCustId,
      // acc_bill_balance carries a single salesman; the order carries an array.
      ablSalesmanId: order.soSalesmanId?.[0] ?? null,
      ablAgentId: order.soAgentId ?? null,
      ablBillType: ADVANCE_BILL_TYPE,
      // ck_abl_src_doc wants module, type and id together. This is what lets an
      // ADVANCE say WHICH order it was taken against, without going through the
      // voucher.
      ablSrcModule: ORDER_SRC_MODULE,
      ablSrcDocType: ORDER_SRC_DOC_TYPE,
      ablSrcDocId: order.soId,
      ablSrcAccYear: order.soAccYear,
      // ck_abl_voucher: not an OPENING, so both of these are required.
      ablVoucherId: voucher.voucherId,
      ablVoucherTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
      ablVoucherNo: voucher.voucherNo,
      ablVoucherDate: voucher.voucherDate,
      ablVoucherRefno: voucher.voucherRefno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
      // The order is the document this outstanding is known by — there is no
      // bill number to quote, which is the whole point of an ADVANCE.
      // ux_abl_doc_refno makes it unique per company, party, type and year.
      ablDocRefno: order.soOrderRefno.slice(0, BILL_REFNO_MAX_LENGTH),
      ablDocDate: order.soOrderDate,
      // No due date and no credit days: nothing is owed BY the customer here.
      // ck_abl_due_date only bites when a due date is given.
      ablDrCr: ADVANCE_BILL_DR_CR,
      ablBillAmount: amount,
      ablNarration: describeAdvance(order),
      ablCreatedOn: now,
      ablCreatedBy: actor,
      ...(await resolveAdvanceAllocation(tx, order, null, amount)),
    },
    select: { ablId: true },
  });
  return created.ablId;
}
// How much of the advance has already been used up — adjusted into a bill,
// refunded or forfeited — so abl_pending_amount reads as what is still HELD,
// which is the order's own so_advance_balance_amt.
//
// abl_alloc_amount is declared trigger-maintained from acc_bill_adjustment, and
// that trigger is not written yet, so the posting code owns the column exactly
// as the bill's cash-paid seeding does. The moment a real adjustment exists it
// owns the number instead: writing it here would silently wipe a receipt that
// has already been allocated, so this answers an empty patch and leaves it be.
async function resolveAdvanceAllocation(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingSource,
  billId: string | null,
  amount: Prisma.Decimal,
): Promise<{ ablAllocAmount?: Prisma.Decimal }> {
  if (billId !== null) {
    const adjustments = await tx.accBillAdjustment.count({
      // Counted by bill id alone, without abj_bill_acc_year: the id is unique
      // across every partition, and a settlement sitting in a later year's
      // partition than the advance is exactly what has to be found here.
      where: { abjBillId: billId, abjIsDeleted: false },
    });
    if (adjustments > 0) {
      return {};
    }
  }
  const used = toDecimal(order.soAdvanceAdjustedAmt)
    .plus(toDecimal(order.soAdvanceRefundAmt))
    .plus(toDecimal(order.soAdvanceForfeitAmt));
  // ck_abl_settled: what is settled can never exceed the bill. The service
  // already refuses roll-ups that use more than was received, so the clamp is
  // only a backstop against a caller that does not.
  return { ablAllocAmount: used.greaterThan(amount) ? amount : used };
}
// Takes the order's outstanding advance out of the books, whatever receipt it
// was raised through. Answers the ids retired — normally at most one.
async function retireAdvanceBill(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingRef,
  actor: string,
  now: Date,
): Promise<string[]> {
  const bills = await tx.accBillBalance.findMany({
    where: {
      ablSrcModule: ORDER_SRC_MODULE,
      ablSrcDocType: ORDER_SRC_DOC_TYPE,
      ablSrcDocId: order.soId,
      ablIsDeleted: false,
    },
    select: {
      ablId: true,
      ablAccYear: true,
      ablDocRefno: true,
      ablAllocAmount: true,
      ablDiscAmount: true,
      ablWriteoffAmount: true,
    },
  });
  const retired: string[] = [];
  for (const bill of bills) {
    await ensureAdvanceCanBeRetired(tx, bill);
    await retireBillRow(tx, bill, actor, now);
    retired.push(bill.ablId);
  }
  return retired;
}
// An advance with a real settlement against it cannot go: that adjustment would
// be left pointing at an outstanding row that no longer exists.
//
// abl_alloc_amount alone does NOT prove one, because resolveAdvanceAllocation
// seeds it from the order's own refunded / forfeited / adjusted roll-ups — a
// fully refunded advance is "allocated" to its own value without any adjustment
// existing, and must still be deletable. So the adjustments are counted rather
// than inferred from the column.
async function ensureAdvanceCanBeRetired(
  tx: Prisma.TransactionClient,
  bill: AdvanceBillRow,
): Promise<void> {
  const adjustments = await tx.accBillAdjustment.count({
    where: { abjBillId: bill.ablId, abjIsDeleted: false },
  });
  const settled = toDecimal(bill.ablDiscAmount).plus(toDecimal(bill.ablWriteoffAmount));
  if (adjustments === 0 && !settled.greaterThan(0)) {
    return;
  }
  throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
    'Order advance cannot be removed',
    [
      {
        field: 'tenders',
        message:
          `The advance on order ${bill.ablDocRefno} has already been settled against in accounts, ` +
          'so it cannot be taken back out. Reverse the settlement first.',
      },
    ],
  );
}
async function findAdvanceBill(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingRef,
): Promise<AdvanceBillRow | null> {
  // Keyed off the source document, like the voucher lookup and for the same
  // reason: no client-writable column can point an order at someone else's row.
  return tx.accBillBalance.findFirst({
    where: {
      ablSrcModule: ORDER_SRC_MODULE,
      ablSrcDocType: ORDER_SRC_DOC_TYPE,
      ablSrcDocId: order.soId,
      ablIsDeleted: false,
    },
    select: {
      ablId: true,
      ablAccYear: true,
      ablDocRefno: true,
      ablAllocAmount: true,
      ablDiscAmount: true,
      ablWriteoffAmount: true,
    },
  });
}
// Soft delete rather than a hard one: ux_abl_doc_refno skips deleted rows, so
// the order's refno is freed while the row stays for audit.
async function retireBillRow(
  tx: Prisma.TransactionClient,
  bill: { ablId: string; ablAccYear: string },
  actor: string,
  now: Date,
): Promise<void> {
  await tx.accBillBalance.update({
    where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
    data: {
      ablIsActive: false,
      ablIsDeleted: true,
      ablModifiedOn: now,
      ablModifiedBy: actor,
    },
  });
}
// ck_abl_settled would reject this at the database with a bare 23514, so the
// same rule is checked here to say which money is actually in the way. Judged
// against 0 when the advance is going altogether: money already adjusted
// against an invoice cannot be left pointing at an advance that no longer
// exists.
function ensureNothingSettledAgainstAdvance(
  bill: {
    ablDocRefno: string;
    ablAllocAmount: Prisma.Decimal;
    ablDiscAmount: Prisma.Decimal;
    ablWriteoffAmount: Prisma.Decimal;
  },
  amount: Prisma.Decimal,
): void {
  const settled = toDecimal(bill.ablAllocAmount)
    .plus(toDecimal(bill.ablDiscAmount))
    .plus(toDecimal(bill.ablWriteoffAmount));
  if (settled.greaterThan(amount)) {
    throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      'Order advance cannot be updated',
      [
        {
          field: 'soAdvanceRecdAmt',
          message:
            `The advance on order ${bill.ablDocRefno} already has ${settled.toString()} settled ` +
            `against it in accounts, so it cannot be changed to ${amount.toString()}. ` +
            'Reverse the settlement first.',
        },
      ],
    );
  }
}
function describeAdvance(order: OrderAdvancePostingSource): string {
  return `Advance received against order ${order.soOrderRefno}`;
}
// acc_tender_detail.td_voucher_id is the tender's own pointer at the receipt it
// was posted through ("filled at posting"), so the money can be traced from
// either end.
async function stampTenderVoucher(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingRef,
  voucherId: string,
): Promise<void> {
  await tx.accTenderDetail.updateMany({
    where: {
      tdSrcModule: ORDER_SRC_MODULE,
      tdSrcDocType: ORDER_SRC_DOC_TYPE,
      tdSrcDocId: order.soId,
      tdIsDeleted: false,
    },
    data: { tdVoucherId: voucherId },
  });
}
async function clearTenderVoucher(
  tx: Prisma.TransactionClient,
  order: OrderAdvancePostingRef,
): Promise<void> {
  await tx.accTenderDetail.updateMany({
    where: {
      tdSrcModule: ORDER_SRC_MODULE,
      tdSrcDocType: ORDER_SRC_DOC_TYPE,
      tdSrcDocId: order.soId,
      tdVoucherId: { not: null },
    },
    data: { tdVoucherId: null },
  });
}
