export type { InventoryErrorDetail as ItemQtywiseRateErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemQtywiseRateErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as ItemQtywiseRateSuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as ItemQtywiseRateListMeta } from 'src/common/types/module-list.types';
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
