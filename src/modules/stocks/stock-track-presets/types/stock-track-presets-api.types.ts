export type { InventoryErrorDetail as StockTrackPresetsErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as StockTrackPresetsErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as StockTrackPresetsSuccessResponse } from 'src/common/types/module-api.types';
/**
 * Everything the item / item-group screens need to fill their form from a
 * preset, plus the signature.
 *
 * The signature is here because it is how a screen answers "which preset is
 * this policy?" — match stp_track_signature against spt_track_signature, and
 * show "Custom" when nothing matches. That comparison is deliberately
 * client-side: there is no server-side link between a policy and a preset.
 */
export interface StockTrackPresetsPayload {
  spt_id: string;
  /** null = a preset shared with every company. */
  spt_company_id: string | null;
  spt_code: string;
  spt_name: string;
  spt_description: string | null;
  spt_track_batch: boolean;
  spt_track_mrp: boolean;
  spt_track_sale_price: boolean;
  spt_track_expiry: boolean;
  spt_track_serial: boolean;
  spt_track_supplier: boolean;
  /** B/M/S/E/R/P in that order, 'N' when nothing is tracked. */
  spt_track_signature: string | null;
  spt_valuation_method: string;
  spt_issue_strategy: string;
  spt_allow_negative: string;
  spt_shelf_life_days: number | null;
  spt_near_expiry_days: number;
  spt_block_expired_sale: boolean;
  spt_ageing_basis: string;
  spt_sort_order: number;
  spt_remarks: string | null;
  /** true when this row overrides a shared preset of the same code. */
  spt_is_company_override: boolean;
}
export interface StockTrackPresetsGetMeta {
  company_id: string | null;
  spt_id?: string;
  spt_code?: string;
  count: number;
}
