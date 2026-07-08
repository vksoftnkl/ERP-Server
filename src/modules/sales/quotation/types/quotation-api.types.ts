import { SaleQuotation, SaleQuotationItem } from '@prisma/client';

export type QuotationPayload = Omit<
  SaleQuotation,
  'sqCreatedOn' | 'sqModifiedOn' | 'sqQuoteDatetime' | 'sqSyncDate'
> & {
  sqCreatedOn?: string;
  sqModifiedOn?: string | null;
  sqQuoteDatetime?: string;
  sqSyncDate?: string | null;
  items?: QuotationItemPayload[];
};

export type QuotationItemPayload = Omit<
  SaleQuotationItem,
  'sqiCreatedOn' | 'sqiModifiedOn' | 'sqiSyncDate'
> & {
  sqiCreatedOn?: string;
  sqiModifiedOn?: string | null;
  sqiSyncDate?: string | null;
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
