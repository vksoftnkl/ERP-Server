export interface ItemQtywiseRateErrorDetail {
  field: string;
  message: string;
}

export interface ItemQtywiseRateErrorResponse {
  success: false;
  message: string;
  errors: ItemQtywiseRateErrorDetail[];
}

export interface ItemQtywiseRateSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface ItemQtywiseRatePayload {
  iqr_id: string;
  iqr_branch_id: string | null;
  iqr_unit_rate_id: string;
  iqr_price_level: number;
  iqr_start_qty: number;
  iqr_end_qty: number | null;
  iqr_each_qty: number;
  iqr_sales_price: number;
  iqr_price_wot: number;
  iqr_price_margin: number;
  iqr_disc_perc: number;
  iqr_disc_qty: number;
  iqr_valid_from: string | null;
  iqr_valid_to: string | null;
  iqr_priority: number;
  iqr_is_active: boolean;
  iqr_is_deleted: boolean;
  iqr_created_on: string;
  iqr_created_by: string | null;
  iqr_modified_on: string;
  iqr_modified_by: string | null;
  iqr_remarks: string | null;
}

export type ItemQtywiseRateListItem = ItemQtywiseRatePayload | Record<string, unknown>;

export interface ItemQtywiseRateListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
