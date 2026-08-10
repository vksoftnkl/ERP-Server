import { SaleOrder, SaleOrderAdvanceAlloc, SaleOrderItem } from '@prisma/client';
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
  advances?: SaleOrderAdvancePayload[];
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
// An advance allocation row is owned by THIS module (sales.sale_order_advance_alloc
// has no owner module of its own, unlike the charge / tender lines), so its
// payload is shaped here: audit timestamps as ISO strings, everything else as
// Prisma returns it.
export type SaleOrderAdvancePayload = Omit<
  SaleOrderAdvanceAlloc,
  'soaCreatedOn' | 'soaModifiedOn' | 'soaSyncDate'
> & {
  soaCreatedOn?: string;
  soaModifiedOn?: string | null;
  soaSyncDate?: string | null;
  // Resolved the same way as the header's, and equally read-only.
  soaCompanyName?: string | null;
  soaBranchName?: string | null;
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
