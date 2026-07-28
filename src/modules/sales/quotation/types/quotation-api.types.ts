import { SaleChargeDetail, SaleQuotation, SaleQuotationItem } from '@prisma/client';

// sale_charge_detail is polymorphic — a quotation's applied charges are the rows
// carrying this discriminator plus cdDocId = sqId (see ck_cd_doc_type).
export const QUOTATION_CHARGE_DOC_TYPE = 'QUOTATION';

export type QuotationPayload = Omit<
  SaleQuotation,
  'sqCreatedOn' | 'sqModifiedOn' | 'sqQuoteDatetime' | 'sqSyncDate'
> & {
  sqCreatedOn?: string;
  sqModifiedOn?: string | null;
  sqQuoteDatetime?: string;
  sqSyncDate?: string | null;
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
