export interface ItemPriceErrorDetail {
  field: string;
  message: string;
}

export interface ItemPriceErrorResponse {
  success: false;
  message: string;
  errors: ItemPriceErrorDetail[];
}

export interface ItemPriceSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface ItemPricePayload {
  ipm_unit_rate_id: string;
  ipm_item_id: string;
  ipm_unit_id: string;
  ipm_godown_id: string | null;
  ipm_unit_slno: number;
  ipm_conversion_factor: number;
  ipm_cost_price: number;
  ipm_cost_wot: number;
  ipm_sales_price_a: number;
  ipm_sales_price_b: number;
  ipm_sales_price_c: number;
  ipm_sales_price_d: number;
  ipm_price_a_wot: number;
  ipm_price_b_wot: number;
  ipm_price_c_wot: number;
  ipm_price_d_wot: number;
  ipm_price_a_margin: number;
  ipm_price_b_margin: number;
  ipm_price_c_margin: number;
  ipm_price_d_margin: number;
  ipm_max_price: number;
  ipm_min_price: number;
  ipm_disc_perc: number;
  ipm_disc_qty: number;
  ipm_addl_cess: number;
  ipm_profit_type: string;
  ipm_round_off: number;
  ipm_big_unit: boolean;
  ipm_uom_weight: number;
  ipm_loading_charge: number;
  ipm_freight_charge: number;
  ipm_remarks: string | null;
  ipm_is_active: boolean;
  ipm_created_on: string;
  ipm_created_by: string | null;
  ipm_modified_on: string;
  ipm_modified_by: string | null;
}

export type ItemPriceListItem = ItemPricePayload | Record<string, unknown>;

export interface ItemPriceListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
