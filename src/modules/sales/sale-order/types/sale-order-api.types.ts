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
// The value the cancel endpoint's srcModule query param must carry. It is the
// same token as the status trail's module — a sale order is only ever reachable
// from SALES — and it exists so a screen that passes its own module blindly
// gets a 400 naming the field rather than silently cancelling someone's order.
export const SALE_ORDER_CANCEL_SRC_MODULE: string = SALE_ORDER_STATUS_SRC_MODULE;
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
