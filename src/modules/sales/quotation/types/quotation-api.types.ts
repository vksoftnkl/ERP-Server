import { TransactionChargeDetail, SaleQuotation, SaleQuotationItem } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
import {
  TxnStatusDocType,
  TxnStatusSrcModule,
} from '../../../../common/txn-status-log/txn-status-log.helper';
// txn_charge_detail is polymorphic — a quotation's applied charges are the rows
// carrying this discriminator plus cdDocId = sqId (see ck_cd_doc_type).
export const QUOTATION_CHARGE_DOC_TYPE = ChargeDocType.QUOTATION;
// public.txn_status_log is polymorphic the same way — a quotation's status trail
// is the rows carrying this (module, doc type) pair plus tslSrcDocId = sqId (see
// ck_tsl_src_module / ck_tsl_src_doc_type). A separate vocabulary from
// ck_cd_doc_type's, which happens to spell QUOTATION the same way.
export const QUOTATION_STATUS_SRC_MODULE = TxnStatusSrcModule.SALES;
export const QUOTATION_STATUS_SRC_DOC_TYPE = TxnStatusDocType.QUOTATION;
// sqQuoteSlno is a bigint column; it is emitted as a string because JSON has no
// bigint. Leaving it a bigint makes res.json() throw AFTER the save transaction
// has committed, so the caller sees a 500 for a quotation that was in fact
// written — the failure mode this Omit exists to prevent.
export type QuotationPayload = Omit<
  SaleQuotation,
  'sqCreatedOn' | 'sqModifiedOn' | 'sqQuoteDatetime' | 'sqSyncDate' | 'sqQuoteSlno'
> & {
  sqCreatedOn?: string;
  sqModifiedOn?: string | null;
  sqQuoteDatetime?: string;
  sqSyncDate?: string | null;
  sqQuoteSlno: string;
  // Master names resolved for the id columns on the header. Like the line
  // items' sqiItemName/sqiUnitName these are read-only display fields, only
  // populated on GET — the create/update paths return null for them.
  sqCustAreaName?: string | null;
  sqCustAreaDistanceKm?: number | null;
  sqSalesmanName?: string | null;
  sqAgentName?: string | null;
  items?: QuotationItemPayload[];
  charges?: QuotationChargePayload[];
};
export type QuotationItemPayload = Omit<
  SaleQuotationItem,
  'sqiCreatedOn' | 'sqiModifiedOn' | 'sqiSyncDate'
> & {
  sqiCreatedOn?: string;
  sqiModifiedOn?: string | null;
  sqiSyncDate?: string | null;
  sqiItemName?: string | null;
  sqiUnitName?: string | null;
  // Item/unit master attributes resolved for the line's sqiItemId and
  // sqiItemUnitId. Read-only display fields on the same footing as
  // sqiItemName/sqiUnitName — only populated on GET.
  sqiDecimalCount?: number | null;
  sqiBatchConfig?: number | null;
  sqiGroupId?: string | null;
  sqiBrandId?: string | null;
  sqiSectionId?: string | null;
  sqiCategoryId?: string | null;
  // May this line's item go below zero on hand — the effective answer, not the
  // item master flag alone: a service item always may, and otherwise it is
  // blocked only when the godown, the company AND the item all disallow it.
  // The same rule /item-price answers with when the line is first added.
  sqiAllowNegativeStock?: boolean | null;
  // sale_quotation_item has no godown column — a quotation reserves nothing —
  // but the entry screen still shows a godown per line, and a conversion to an
  // order or a bill needs one. Both are the branch's default godown
  // (branch_master.br_default_godown_id), resolved on GET like the fields
  // above, and null when the branch has no default set.
  sqiGodownId?: string | null;
  sqiGodownName?: string | null;
};
// cdVoucherNo is a bigint column; it is emitted as a string because JSON has no
// bigint (same convention as the header's sqQuoteSlno).
export type QuotationChargePayload = Omit<
  TransactionChargeDetail,
  'cdCreatedOn' | 'cdModifiedOn' | 'cdSyncDate' | 'cdVoucherNo'
> & {
  cdCreatedOn?: string;
  cdModifiedOn?: string | null;
  cdSyncDate?: string | null;
  cdVoucherNo?: string | null;
};
export type QuotationErrorDetail = {
  field: string;
  message: string;
};
export type QuotationErrorResponse = {
  statusCode?: number;
  success: false;
  message: string;
  errors: QuotationErrorDetail[];
};
export type QuotationSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};
// What a DOWNSTREAM document puts in its own src_doc_type column to say it was
// raised from a quotation — sb_src_doc_type on a sale bill. It spells the same
// word as QUOTATION_STATUS_SRC_DOC_TYPE and is deliberately a separate constant:
// that one names a row in the status trail's vocabulary, this one is the
// discriminator the bill stores, and the two are free to drift.
export const QUOTATION_SRC_DOC_TYPE: string = TxnStatusDocType.QUOTATION;
// sq_status once the quotation has become another document, and the value
// sq_converted_doc_type carries when that document is a sale bill.
export const QUOTATION_STATUS_CONVERTED = 'CONVERTED';
export const QUOTATION_CONVERTED_DOC_TYPE_BILL: string = TxnStatusDocType.SALE_BILL;
// Where a quotation goes when the last live bill naming it walks away and the
// trail has no CONVERTED step to read the previous status back off. A quotation
// somebody billed was agreed to, so ACCEPTED is the honest floor; the trail is
// what supplies the truthful answer in every ordinary case.
export const QUOTATION_STATUS_ACCEPTED = 'ACCEPTED';
// How the calling document names its own source-doc columns, so a rejection
// raised by the conversion sync comes back naming the field the client actually
// sent (sbSrcDocId) instead of a token from this module's vocabulary.
export type QuotationSrcDocFields = {
  docId: string;
  accYear: string;
};
// One quotation a downstream document points at. sale_quotation is partitioned
// by sq_acc_year, so both halves of the primary key travel together — an id
// without its year addresses no row.
export type QuotationConversionRef = {
  srcDocId: string;
  srcAccYear: string;
  fields: QuotationSrcDocFields;
};
// What one quotation's conversion columns were left holding. Reported back to
// the caller so a bill save can show the screen what happened to the quote it
// came from.
export type QuotationConversionResult = {
  sqId: string;
  sqAccYear: string;
  sqStatus: string;
  sqConvertedDocType: string | null;
  sqConvertedDocId: string | null;
  sqConvertedOn: string | null;
};
