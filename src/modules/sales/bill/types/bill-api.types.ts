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
import {
  TxnStatusDocType,
  TxnStatusSrcModule,
} from '../../../../common/txn-status-log/txn-status-log.helper';
import type { TenderTempCreditDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import type { LocksBlock, PostingBlock, RightsBlock } from '../../posting/types/posting.types';
import type { TransportBandRow } from '../../posting/transport-band.service';
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
// public.txn_status_log is polymorphic in the same way — a bill's status trail
// is the rows carrying this (module, doc type) pair plus tslSrcDocId = sbId (see
// ck_tsl_src_module / ck_tsl_src_doc_type). SALE_BILL here, not the tender
// module's coincidentally identical value: the two constraints are separate
// vocabularies that happen to agree.
export const BILL_STATUS_SRC_MODULE = TxnStatusSrcModule.SALES;
export const BILL_STATUS_SRC_DOC_TYPE = TxnStatusDocType.SALE_BILL;
// The status that puts the bill into the books: a bill created or saved with it
// also writes accounts.acc_voucher_header + accounts.acc_bill_balance (see
// postBillToAccounts). It lives out here rather than in bill.service because the
// sale-order module reads it too — only a POSTED bill draws quantity down off an
// order line, so its fulfilment recompute has to know which bills count.
export const BILL_STATUS_POSTED = 'POSTED';
// A saved bill is a DRAFT; only /bills/post moves it (HANDOVER §2.1).
export const BILL_STATUS_DRAFT = 'DRAFT';
// The status a bill reaches when it is called off. It lives out here for the
// same reason BILL_STATUS_POSTED does — the quotation module reads it: a
// CANCELLED bill no longer converts the quotation it was raised from, so the
// conversion recompute has to know which bills stopped counting.
export const BILL_STATUS_CANCELLED = 'CANCELLED';
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
  // ── HANDOVER §2.7 — the blocks a GET carries ─────────────────────────────
  posting?: PostingBlock;
  locks?: LocksBlock;
  rights?: RightsBlock;
  sources?: BillSourceSummary[];
  tempCredits?: BillTempCreditSummary[];
  adjustments?: BillAdjustmentSummary[];
  transport?: TransportBandRow | null;
  // The band, echoed flat as §2.1 sends it.
  sbShipAddrId?: string | null;
  sbShipName?: string | null;
  sbShipAddr?: string | null;
  sbShipPlace?: string | null;
  sbShipPin?: string | null;
  sbShipPhone?: string | null;
  sbShipStcd?: string | null;
  sbShipGstin?: string | null;
  sbDispatchGodownId?: string | null;
  sbDispatchBranchId?: string | null;
  sbTransportMode?: string | null;
  sbTransporterId?: string | null;
  sbTransporterName?: string | null;
  sbTransporterGstin?: string | null;
  sbLrNo?: string | null;
  sbLrDate?: string | null;
  sbDistanceKm?: number | null;
};
export interface BillSourceSummary {
  kind: 'DC' | 'ORDER' | 'QUOTATION';
  docId: string;
  accYear: string;
  refno: string | null;
  date: string | null;
  lines: number;
  takenQty: number;
  openQtyAfter: number | null;
}
export interface BillTempCreditSummary {
  atcId: string;
  name: string;
  mobile: string;
  balance: number;
  dueDate: string | null;
  status: string;
}
export interface BillAdjustmentSummary {
  againstBillId: string;
  againstBillAccYear: string;
  refno: string | null;
  amount: number;
  adjType: string;
}
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
  // May this line's item go below zero on hand — the effective answer, not the
  // item master flag alone: a service item always may, and otherwise it is
  // blocked only when the line's godown, the company AND the item all disallow
  // it. The same rule /item-price answers with when the line is first added.
  sbiAllowNegativeStock?: boolean | null;
};
// An applied charge line is exactly what the charge-detail module answers with,
// whether it was read through this module or its own: decimals as numbers,
// timestamps as ISO strings, cdVoucherNo (bigint) as a string because JSON has
// no bigint — the same convention as the header's sbBillSlno — plus the mapped
// ledger's name.
export type BillChargePayload = ChargeDetailPayload;
// Likewise for a tendered amount: the tender-detail module's payload verbatim,
// whether it was read through this module or its own.
/**
 * A tender row as the bill answers it. On a TEMP_CR row the WHO behind the
 * credit — parked on the row's spare columns between /create and /post (see
 * bill-temp-credit.ts) — is echoed back decoded as `tempCredit`.
 */
export type BillTenderPayload = TenderDetailPayload & {
  tempCredit?: TenderTempCreditDto | null;
};
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
