export interface ItemStockBalanceErrorDetail {
  field: string;
  message: string;
}
export interface ItemStockBalanceErrorResponse {
  success: false;
  message: string;
  errors: ItemStockBalanceErrorDetail[];
}
export interface ItemStockBalanceSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}
export interface ItemStockBalancePayload {
  isb_id: string;
  isb_acc_year: string;
  isb_company_id: string;
  isb_branch_id: string;
  isb_godown_id: string;
  isb_item_id: string;
  isb_unit_id: string;
  isb_tracking_type: string;
  isb_stock_bucket: string;
  isb_opening_qty: number;
  isb_in_qty: number;
  isb_out_qty: number;
  isb_closing_qty: number;
  isb_opening_free_qty: number;
  isb_free_in_qty: number;
  isb_free_out_qty: number;
  isb_free_closing_qty: number;
  isb_reserved_qty: number;
  isb_transit_qty: number;
  isb_available_qty: number;
  book_qty: number;
  book_base_qty: number;
  isb_opening_avg_rate: number;
  isb_avg_stock_rate: number;
  isb_opening_value: number;
  isb_stock_value: number;
  isb_opening_avg_rate_wot: number;
  isb_avg_stock_rate_wot: number;
  isb_opening_value_wot: number;
  isb_stock_value_wot: number;
  isb_last_in_date: string | null;
  isb_last_out_date: string | null;
  isb_sync_date: string | null;
  isb_created_on: string;
  isb_created_by: string | null;
  isb_updated_on: string | null;
  isb_updated_by: string | null;
}
