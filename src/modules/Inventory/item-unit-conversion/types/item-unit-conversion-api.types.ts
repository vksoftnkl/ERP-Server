export type { InventoryErrorDetail as ItemUnitConversionErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemUnitConversionErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as ItemUnitConversionSuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as ItemUnitConversionListMeta } from 'src/common/utils/module-list.utils';
export interface ItemUnitConversionDeleteResult {
  iuc_id: string;
  deleted: boolean;
}

export interface ItemUnitConversionPayload {
  iuc_id: string;
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
  // Resolved names for the foreign-key ids above (populated by the item composite get endpoint).
  iuc_unit_name?: string | null;
  iuc_base_unit_name?: string | null;
  /** Item composite get only (item master review 11-20 Q2): this row's unit can no longer be
   *  re-picked — the base row once the item is used at all, any other row once it is used. */
  iuc_in_use?: boolean;
  /** What holds it ("stock", "sale bill", "purchase invoice" …), in a fixed order; [] when unused. */
  iuc_used_by?: string[];
}

export type ItemUnitConversionListItem = ItemUnitConversionPayload | Record<string, unknown>;
