import { SaleOrder, SaleOrderItem } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
import type {
  ChargeDetailPayload,
  ChargeDocumentAudit,
} from '../../../master/charge-detail/types/charge-detail-api.types';
import {
  TenderDrCr,
  TenderSrcDocType,
  TenderSrcModule,
} from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
import {
  TxnStatusDocType,
  TxnStatusSrcModule,
} from '../../../../common/txn-status-log/txn-status-log.helper';
import type {
  TenderDetailPayload,
  TenderDocumentAudit,
} from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
// txn_charge_detail is polymorphic — an order's applied charges are the rows
// carrying this discriminator plus cdDocId = soId. ORDER was added to
// ChargeDocType alongside this module; txn_charge_detail carries no
// ck_cd_doc_type CHECK any more, so the enum alone defines the allowed set.
export const SALE_ORDER_CHARGE_DOC_TYPE = ChargeDocType.ORDER;
// The charge lines are written by the charge-detail module, but they are part of
// an order save, so they are audited against the order's own screen and table.
export const SALE_ORDER_CHARGE_AUDIT: ChargeDocumentAudit = {
  tableName: 'txn_charge_detail',
  screenName: 'Sale Order',
  entityName: 'Order charge',
};
// acc_tender_detail is polymorphic the same way — an order's tendered money
// (the advance the customer paid up front) is the rows carrying this
// (module, doc type) pair plus tdSrcDocId = soId. SALES_ORDER has been a
// TenderSrcDocType member since the tender module shipped.
export const SALE_ORDER_TENDER_SRC_MODULE = TenderSrcModule.SALES;
export const SALE_ORDER_TENDER_SRC_DOC_TYPE = TenderSrcDocType.SALES_ORDER;
// Money a customer hands over against an order lands on the DEBIT side, exactly
// like a bill's: the tender ledger (cash / bank / card clearing) is what the
// business receives.
export const SALE_ORDER_TENDER_DR_CR = TenderDrCr.DR;
// Same audit relabelling as the charge lines: written by the tender-detail
// module, logged against the order's own screen and table.
export const SALE_ORDER_TENDER_AUDIT: TenderDocumentAudit = {
  tableName: 'acc_tender_detail',
  screenName: 'Sale Order',
  entityName: 'Order tender',
};
// public.txn_status_log is polymorphic the same way the charge and tender
// tables are: an order's status trail is the rows carrying this (module, doc
// type) pair plus tslSrcDocId = soId. SALES_ORDER has been a TxnStatusDocType
// member since the helper shipped; this module is the first to write one.
export const SALE_ORDER_STATUS_SRC_MODULE = TxnStatusSrcModule.SALES;
export const SALE_ORDER_STATUS_SRC_DOC_TYPE = TxnStatusDocType.SALES_ORDER;
// so_doc_type's allowed set, mirroring ck_so_doc_type (migration
// 20260808132323) alongside the service's other CHECK mirrors. It lives here
// rather than there because the cancel endpoint's srcModule vocabulary is built
// from it, and one list is what keeps the two from drifting apart.
export const SALE_ORDER_DOC_TYPES = ['SALES_ORDER', 'BOOKING', 'CUSTOM_ORDER'] as const;
// What the cancel endpoint's srcModule query param accepts, in the order the
// 400 message lists them. SALES is the module proper — the same token as the
// status trail's, because a sale order is reachable from no other module — and
// the rest are the doc types a sale_order row can carry. SALES_ORDER is the one
// a downstream document stores beside the id (sale_bill_item.sbi_src_doc_type /
// sale_bill.sb_src_doc_type), and the sales line screen holds the order as that
// tuple, so it forwards the doc type where the parameter is named for the
// module; BOOKING and CUSTOM_ORDER are sale_order rows just the same, and the
// screen holding one forwards ITS so_doc_type by the identical path.
//
// Every one of them spells the same thing — this order — so all are honoured
// rather than forcing every caller to carry a second constant just for this
// parameter. A SALE_BILL or DELIVERY_CHALLAN still 400s naming the field, which
// is the point of validating it at all: those are documents of their own with
// their own endpoints, and neither may cancel an order through this one.
export const SALE_ORDER_CANCEL_SRC_MODULES: readonly string[] = [
  SALE_ORDER_STATUS_SRC_MODULE,
  ...SALE_ORDER_DOC_TYPES,
];
// The token a DOWNSTREAM document writes into its own source-doc discriminator
// to say "this line came from a sale order line". sale_bill_item carries it as
// sbi_src_doc_type, alongside sbi_src_doc_id / sbi_src_doc_year /
// sbi_src_doc_line_no — which together address exactly one sale_order_item row:
// the order's (so_id, so_acc_year) primary key plus the line's number.
//
// Not to be confused with soi_src_doc_type on the order line itself, which
// points the other way (UP the chain, at the quotation the order came from).
export const SALE_ORDER_SRC_DOC_TYPE: string = SALE_ORDER_STATUS_SRC_DOC_TYPE;
// One order — or one line of one — a downstream document points at.
//
// srcDocId is whatever the calling document stored, at either of the two grains
// this module answers to, exactly as PUT /cancel-lines resolves its own
// srcDocId:
//
//   · a soi_id — the order LINE, addressed directly. This is what a bill line
//     converted from an order carries in sbi_src_doc_id, and it needs no line
//     number: the id IS the line.
//   · a so_id — the ORDER. A bill line pairs it with soLineNo (soi_line_no, the
//     printed line, not soi_id) to say which line it drew down; the bill HEADER
//     pairs it with nothing, because sb_src_doc_id says which order the bill was
//     raised against and nothing finer.
//
// A reference that names no line adds nothing to the set of lines that must
// exist — it asks for the order to be re-derived from its bills. Quantity
// always comes from the bill LINES that name one.
export type SaleOrderLineRef = {
  srcDocId: string;
  // The ORDER's own accounting year either way: sale_order and sale_order_item
  // share it, so it is the second half of whichever primary key srcDocId
  // belongs to.
  srcAccYear: string;
  soLineNo: number | null;
  // The columns THIS reference was read out of, so a rejection names the field
  // the client actually sent — sbSrcDocId for a header reference, sbiSrcDocId
  // for a line one.
  fields: SaleOrderSrcDocFields;
};
// How the calling document names its own source-doc columns. Passed in so a
// rejection raised by the fulfilment recompute comes back naming the field the
// client actually sent (sbiSrcDocLineNo) instead of a token from this module's
// vocabulary the caller never heard of.
export type SaleOrderSrcDocFields = {
  docId: string;
  accYear: string;
  // The line-number column, on a document that has one. A header-level
  // reference names no line, so it has none — and, naming no line, can never
  // raise the rejection this field exists to word.
  lineNo?: string;
};
// What one order line's caches were left holding. Running totals across every
// posted bill, not the delta this call applied — the caller is a bill save that
// wants to show the order's state, and the delta is not a fact any column keeps.
export type SaleOrderFulfilledLine = {
  soiId: string;
  soiLineNo: number;
  // The BILLABLE quantity, carried because the recompute can RAISE it: a bill
  // that delivers more than the line had left revises it up to what actually
  // went out, since a generated soi_pending_qty leaves no other way to record
  // the extra. soi_order_qty — what the customer asked for — does not move.
  soiNetQty: number;
  soiDeliveredQty: number;
  soiCancelledQty: number;
  soiPendingQty: number;
  soiBilledAmt: number;
  soiLineStatus: string;
};
// One order the fulfilment recompute touched. `lines` carries only the lines
// whose caches actually moved — a repeat save answers with an empty array, the
// same way the cancel endpoint answers 0 on a second call.
export type SaleOrderFulfilmentResult = {
  soId: string;
  soAccYear: string;
  soStatus: string;
  soFulfilStatus: string;
  lines: SaleOrderFulfilledLine[];
};
// soOrderSlno is a bigint column; it is emitted as a string because JSON has no
// bigint. Leaving it a bigint makes res.json() throw AFTER the save transaction
// has committed, so the caller sees a 500 for an order that was in fact written
// — the failure mode this Omit exists to prevent. Unlike sbBillSlno it is NOT
// NULL in the DDL, but the payload type keeps `| null` so a partially-built
// record (audit originals) can still be represented.
export type SaleOrderPayload = Omit<
  SaleOrder,
  'soCreatedOn' | 'soModifiedOn' | 'soOrderDatetime' | 'soSyncDate' | 'soOrderSlno'
> & {
  soCreatedOn?: string;
  soModifiedOn?: string | null;
  soOrderDatetime?: string;
  soSyncDate?: string | null;
  soOrderSlno: string | null;
  // Master names resolved for the header's scope ids. sale_order declares no FK
  // for so_company_id / so_branch_id / so_salesman_id[], so all three are looked
  // up rather than joined. Read-only display fields, only populated on GET — the
  // create/update paths answer null, the same contract as soiItemName.
  soCompanyName?: string | null;
  soBranchName?: string | null;
  // so_salesman_id is a uuid[]: the names come back in the same order, carrying
  // a null wherever the employee row is missing.
  soSalesmanName?: (string | null)[] | null;
  items?: SaleOrderItemPayload[];
  charges?: SaleOrderChargePayload[];
  tenders?: SaleOrderTenderPayload[];
};
export type SaleOrderItemPayload = Omit<
  SaleOrderItem,
  'soiCreatedOn' | 'soiModifiedOn' | 'soiSyncDate'
> & {
  soiCreatedOn?: string;
  soiModifiedOn?: string | null;
  soiSyncDate?: string | null;
  // Item/unit master attributes resolved for the line's soiItemId and
  // soiItemUnitId. Read-only display fields, only populated on GET — the
  // create/update paths return null for them.
  soiItemName?: string | null;
  soiUnitName?: string | null;
  soiDecimalCount?: number | null;
  soiGroupId?: string | null;
  soiBrandId?: string | null;
  soiSectionId?: string | null;
  soiCategoryId?: string | null;
  // Same idea for the line's soiGodownId, except sale_order_item has no FK to
  // inventory.godown_locations, so it is looked up rather than joined.
  soiGodownName?: string | null;
  // ... and for the line's own scope / salesman ids, which have no FKs either.
  soiCompanyName?: string | null;
  soiBranchName?: string | null;
  soiSalesmanName?: string | null;
};
// An applied charge line is exactly what the charge-detail module answers with,
// whether it was read through this module or its own: decimals as numbers,
// timestamps as ISO strings, cdVoucherNo (bigint) as a string, plus the mapped
// ledger's name.
// — plus the scope names this module resolves for it, so an order's charge line
// reads without a second call to the company / branch masters.
export type SaleOrderChargePayload = ChargeDetailPayload & {
  cdCompName?: string | null;
  cdBranchName?: string | null;
};
// Likewise for a tendered amount: the tender-detail module's payload verbatim,
// plus the names this module resolves for the ids it leaves unlabelled (the
// tender and its ledger already carry theirs).
export type SaleOrderTenderPayload = TenderDetailPayload & {
  tdCompanyName?: string | null;
  tdPartyLedgerName?: string | null;
  tdUserName?: string | null;
};
export type SaleOrderErrorDetail = {
  field: string;
  message: string;
};
export type SaleOrderErrorResponse = {
  statusCode?: number;
  success: false;
  message: string;
  errors: SaleOrderErrorDetail[];
};
export type SaleOrderSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};
// One line the cancel endpoint closed out. soiCancelledQty is the quantity THIS
// call moved out of pending, not the line's running total — the caller needs to
// know what it just did, and the running total is a GET away.
export type SaleOrderCancelledLine = {
  soiId: string;
  soiLineNo: number;
  soiCancelledQty: number;
  soiLineStatus: string;
};
// What PUT /sale-orders/cancel-lines answers with: the header's settled state
// plus a line-by-line account of what was cancelled, so the calling screen can
// refresh without a second round trip. cancelledLines is 0 on a repeat call —
// the route is idempotent, not an error.
export type SaleOrderCancelLinesResult = {
  soId: string;
  soAccYear: string;
  soStatus: string;
  soFulfilStatus: string;
  cancelledLines: number;
  cancelledQty: number;
  soCancelledAmt: number;
  soPendingAmt: number;
  lines: SaleOrderCancelledLine[];
};
// What GET /sale-orders/pending-amount answers with: the money still
// outstanding on the accounts.acc_bill_balance rows raised against one source
// document. For an order that is its ADVANCE row — the customer's money the
// company is still holding, no invoice having eaten it yet.
//
// The amount alone: the caller already holds the tuple it asked with, and the
// screen reading this wants one figure to put in one box.
export type SaleOrderSrcDocPendingAmount = {
  ablPendingAmount: number;
};
