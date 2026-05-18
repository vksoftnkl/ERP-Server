export type { InventoryErrorDetail as ItemPriceErrorDetail } from 'src/common/utils/module-api.types';
export type { InventoryErrorResponse as ItemPriceErrorResponse } from 'src/common/utils/module-api.types';
export type { InventorySuccessResponse as ItemPriceSuccessResponse } from 'src/common/utils/module-api.types';
export type { InventoryListMeta as ItemPriceListMeta } from 'src/common/utils/module-list.utils';
export type { InventoryListMeta as ItemUnitConversionListMeta } from 'src/common/utils/module-list.utils';

export interface ItemPriceDeleteResult {
  ipm_id: string;
  deleted: true;
}

export interface ItemUnitConversionDeleteResult {
  iuc_id: string;
  deleted: true;
}

export interface ItemPricePayload {
  ipm_id: string;
  ipm_company_id: string | null;
  ipm_branch_id: string | null;
  ipm_item_id: string;
  ipm_unit_id: string;
  ipm_godown_id: string;
  ipm_base_unit_id: string | null;
  ipm_to_base_factor: number;
  ipm_unit_slno: number;
  ipm_unit_factor: number;
  ipm_is_default_unit: boolean;
  ipm_is_big_unit: boolean;
  ipm_is_base_unit: boolean;
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
  ipm_price_a_markup_perc: number;
  ipm_price_b_markup_perc: number;
  ipm_price_c_markup_perc: number;
  ipm_price_d_markup_perc: number;
  ipm_max_price: number;
  ipm_min_price: number;
  ipm_disc_perc: number;
  ipm_disc_qty: number;
  ipm_addl_cess: number;
  ipm_profit_type: string;
  ipm_round_off: number;
  ipm_loading_charge: number;
  ipm_freight_charge: number;
  ipm_loyalty_points: number;
  ipm_uom_remarks: string | null;
  ipm_cost_remarks: string | null;
  ipm_is_active: boolean;
  ipm_is_deleted: boolean;
  ipm_sync_date: string | null;
  ipm_created_on: string;
  ipm_created_by: string | null;
  ipm_updated_on: string | null;
  ipm_updated_by: string | null;
}

export type ItemPriceListItem = ItemPricePayload | Record<string, unknown>;

export interface ItemUnitConversionPayload {
  iuc_id: string;
  iuc_company_id: string;
  iuc_item_id: string;
  iuc_unit_id: string;
  iuc_base_unit_id: string;
  iuc_to_base_factor: number;
  iuc_unit_slno: number;
  iuc_unit_factor: number;
  iuc_is_default_unit: boolean;
  iuc_is_base_unit: boolean;
  iuc_is_big_unit: boolean;
  iuc_uom_weight: number;
  iuc_uom_remarks: string | null;
  iuc_is_active: boolean;
  iuc_is_deleted: boolean;
  iuc_sync_date: string | null;
  iuc_created_on: string;
  iuc_created_by: string | null;
  iuc_updated_on: string | null;
  iuc_updated_by: string | null;
}

export type ItemUnitConversionListItem =
  | ItemUnitConversionPayload
  | Record<string, unknown>;
