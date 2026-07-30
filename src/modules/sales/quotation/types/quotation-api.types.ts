import { SaleChargeDetail, SaleQuotation, SaleQuotationItem } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
// sale_charge_detail is polymorphic — a quotation's applied charges are the rows
// carrying this discriminator plus cdDocId = sqId (see ck_cd_doc_type).
export const QUOTATION_CHARGE_DOC_TYPE = ChargeDocType.QUOTATION;
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
};
// cdVoucherNo is a bigint column; it is emitted as a string because JSON has no
// bigint (same convention as the header's sqQuoteSlno).
export type QuotationChargePayload = Omit<
  SaleChargeDetail,
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
