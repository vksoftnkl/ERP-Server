export interface ItemTaxHistoryErrorDetail {
  field: string;
  message: string;
}

export interface ItemTaxHistoryErrorResponse {
  success: false;
  message: string;
  errors: ItemTaxHistoryErrorDetail[];
}

export interface ItemTaxHistorySuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface ItemTaxHistoryPayload {
  ith_id: string;
  ith_item_id: string;
  ith_tax_id: string;
  ith_effective_from: string;
  ith_effective_to: string | null;
  ith_reason: string | null;
  ith_created_on: string;
  ith_created_by: string | null;
}

export type ItemTaxHistoryListItem = ItemTaxHistoryPayload | Record<string, unknown>;

export interface ItemTaxHistoryListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
