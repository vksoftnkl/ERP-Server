import { Prisma } from '@prisma/client';
import {
  cancelDocPdcRegister,
  syncDocPdcRegister,
  type PdcDocument,
  type PdcDocumentRules,
  type PdcTenderLine,
  type PdcVoucher,
} from '../posting/pdc-register.helper';
// The register mapping itself lives in ../posting/pdc-register.helper.ts, which
// the sale bill shares. This file is the order's end of it: which source pair
// its tenders carry, what the rows are cancelled FOR, and the order's rule that
// a cheque may not be dated before the order.
export { CHEQUE_TENDER_TYPE_ID } from '../posting/pdc-register.helper';
// The same source pair the order's tender rows carry in acc_tender_detail
// (td_src_module / td_src_doc_type).
const ORDER_SRC_MODULE = 'SALES';
const ORDER_SRC_DOC_TYPE = 'SALES_ORDER';
// ck_apd_cancelled demands a reason on every CANCELLED / RETURNED row.
const TENDER_REMOVED_CANCEL_REASON = 'Cheque no longer tendered on the sale order';
const ORDER_UNPOSTED_CANCEL_REASON = 'Sale order no longer holds tendered money';
const ORDER_DELETED_CANCEL_REASON = 'Sale order deleted';
const ORDER_RULES: PdcDocumentRules = {
  label: 'order',
  refuseBackdated: true,
  checkDateWindow: false,
};
/// Identifies the order whose instruments are being read, for the paths that run
/// from the stored row rather than from a whole order.
export interface OrderPdcRef {
  soId: string;
  soCompanyId: string;
  soAccYear: string;
}
/// The subset of a SaleOrder row the register needs. Declared structurally, like
/// OrderAdvancePostingSource, so the caller passes the Prisma row straight
/// through.
export interface OrderPdcSource extends OrderPdcRef {
  soBranchId: string;
  soTenantId: string | null;
  soOrderRefno: string;
  // The day the instrument arrived: apd_received_on, and the floor
  // ck_apd_dates puts under apd_instrument_date.
  soOrderDate: Date;
  soCustId: string;
  // Whoever the order is made out to — the drawer, unless a third party signed
  // the cheque, which acc_tender_detail has nowhere to say.
  soCustName: string;
  soSalesmanId: string[];
  soUserId: string;
}
/// One acc_tender_detail row, as far as the cheque register cares.
export type OrderPdcTenderLine = PdcTenderLine;
/// The advance receipt the instrument was taken through.
export type OrderPdcVoucher = PdcVoucher;
/// Brings accounts.acc_pdc_register in line with the cheques on an order.
///
/// Runs on every create and update, off the order's live tender rows:
///   * a cheque tender with no register row opens one, HELD
///   * a cheque tender that already has one re-syncs it (amount, cheque number,
///     date, bank, voucher — a tender is editable until it is posted onward)
///   * a register row whose tender is gone, was paid by something other than a
///     cheque, or no longer carries money is CANCELLED
///
/// Must run inside the caller's transaction: an order holding a cheque with no
/// register row behind it is the inconsistency this prevents.
export async function syncOrderPdcRegister(
  tx: Prisma.TransactionClient,
  order: OrderPdcSource,
  tenders: OrderPdcTenderLine[],
  voucher: OrderPdcVoucher | null,
  actor: string,
  now: Date,
): Promise<string[]> {
  return syncDocPdcRegister(tx, toPdcDocument(order), ORDER_RULES, tenders, voucher, actor, now, {
    removedReason: TENDER_REMOVED_CANCEL_REASON,
  });
}
/// Takes every instrument the order holds out of the register, because the
/// order stopped holding money (its receipt was cancelled) or went altogether.
///
/// `deleted` is the difference between the two: an order that still exists only
/// CANCELS its instruments — the row stays for audit, and ux_apd_instrument
/// skips it so the same cheque can be tendered again — whereas a deleted order
/// also retires them, since nothing may keep pointing at a document that is
/// gone.
export async function cancelOrderPdcRegister(
  tx: Prisma.TransactionClient,
  order: OrderPdcRef,
  reason: 'unposted' | 'deleted',
  statusBy: string | null,
  actor: string,
  now: Date,
): Promise<string[]> {
  return cancelDocPdcRegister(
    tx,
    {
      srcModule: ORDER_SRC_MODULE,
      srcDocType: ORDER_SRC_DOC_TYPE,
      docId: order.soId,
      accYear: order.soAccYear,
    },
    ORDER_RULES,
    reason === 'deleted' ? ORDER_DELETED_CANCEL_REASON : ORDER_UNPOSTED_CANCEL_REASON,
    reason === 'deleted',
    statusBy,
    actor,
    now,
  );
}
function toPdcDocument(order: OrderPdcSource): PdcDocument {
  return {
    srcModule: ORDER_SRC_MODULE,
    srcDocType: ORDER_SRC_DOC_TYPE,
    docId: order.soId,
    companyId: order.soCompanyId,
    branchId: order.soBranchId,
    tenantId: order.soTenantId,
    accYear: order.soAccYear,
    refno: order.soOrderRefno,
    docDate: order.soOrderDate,
    // Customer and ledger share a primary key, so soCustId is already the
    // acc_ledger_master id fk_apd_party wants.
    partyId: order.soCustId,
    partyName: order.soCustName,
    // acc_pdc_register carries a single salesman; the order carries an array.
    salesmanId: order.soSalesmanId?.[0] ?? null,
    userId: order.soUserId,
  };
}
