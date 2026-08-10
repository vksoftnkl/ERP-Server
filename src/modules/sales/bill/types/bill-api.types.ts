import { SaleBill, SaleBillItem } from '@prisma/client';
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
// txn_charge_detail is polymorphic — a bill's applied charges are the rows
// carrying this discriminator plus cdDocId = sbId (see ck_cd_doc_type). A bill
// IS the tax invoice, so it reuses the INVOICE discriminator rather than a new
// BILL value that ck_cd_doc_type does not allow.
export const BILL_CHARGE_DOC_TYPE = ChargeDocType.INVOICE;
// The charge lines are written by the charge-detail module, but they are part of
// a bill save, so they are audited against the bill's own screen and table.
export const BILL_CHARGE_AUDIT: ChargeDocumentAudit = {
  tableName: 'txn_charge_detail',
  screenName: 'Sale Bill',
  entityName: 'Bill charge',
};
// acc_tender_detail is polymorphic the same way — a bill's tendered money is the
// rows carrying this (module, doc type) pair plus tdSrcDocId = sbId (see
// ck_td_src_module / ck_td_src_doc_type).
export const BILL_TENDER_SRC_MODULE = TenderSrcModule.SALES;
export const BILL_TENDER_SRC_DOC_TYPE = TenderSrcDocType.SALE_BILL;
// Money a customer hands over against a bill lands on the DEBIT side: the
// tender ledger (cash / bank / card clearing) is what the business receives.
export const BILL_TENDER_DR_CR = TenderDrCr.DR;
// Same audit relabelling as the charge lines: written by the tender-detail
// module, logged against the bill's own screen and table.
export const BILL_TENDER_AUDIT: TenderDocumentAudit = {
  tableName: 'acc_tender_detail',
  screenName: 'Sale Bill',
  entityName: 'Bill tender',
};
// sbBillSlno is a nullable bigint column; it is emitted as a string because
// JSON has no bigint. Leaving it a bigint makes res.json() throw AFTER the save
// transaction has committed, so the caller sees a 500 for a bill that was in
// fact written — the failure mode this Omit exists to prevent.
export type BillPayload = Omit<
  SaleBill,
  'sbCreatedOn' | 'sbModifiedOn' | 'sbBillDatetime' | 'sbSyncDate' | 'sbBillSlno'
> & {
  sbCreatedOn?: string;
  sbModifiedOn?: string | null;
  sbBillDatetime?: string;
  sbSyncDate?: string | null;
  sbBillSlno: string | null;
  items?: BillItemPayload[];
  charges?: BillChargePayload[];
  tenders?: BillTenderPayload[];
};
export type BillItemPayload = Omit<
  SaleBillItem,
  'sbiCreatedOn' | 'sbiModifiedOn' | 'sbiSyncDate'
> & {
  sbiCreatedOn?: string;
  sbiModifiedOn?: string | null;
  sbiSyncDate?: string | null;
  // Item/unit master attributes resolved for the line's sbiItemId and
  // sbiItemUnitId. Read-only display fields, only populated on GET — the
  // create/update paths return null for them.
  sbiItemName?: string | null;
  sbiUnitName?: string | null;
  sbiDecimalCount?: number | null;
  sbiGroupId?: string | null;
  sbiBrandId?: string | null;
  sbiSectionId?: string | null;
  sbiCategoryId?: string | null;
  // Same idea for the line's sbiGodownId, except sale_bill_item has no FK to
  // inventory.godown_locations, so it is looked up rather than joined.
  sbiGodownName?: string | null;
};
// An applied charge line is exactly what the charge-detail module answers with,
// whether it was read through this module or its own: decimals as numbers,
// timestamps as ISO strings, cdVoucherNo (bigint) as a string because JSON has
// no bigint — the same convention as the header's sbBillSlno — plus the mapped
// ledger's name.
export type BillChargePayload = ChargeDetailPayload;
// Likewise for a tendered amount: the tender-detail module's payload verbatim,
// whether it was read through this module or its own.
export type BillTenderPayload = TenderDetailPayload;
export type BillErrorDetail = {
  field: string;
  message: string;
};
export type BillErrorResponse = {
  statusCode?: number;
  success: false;
  message: string;
  errors: BillErrorDetail[];
};
export type BillSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};
