export type { InventoryErrorDetail as ItemReorderErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemReorderErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as ItemReorderSuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as ItemReorderListMeta } from 'src/common/utils/module-list.utils';
export interface ItemReorderDeleteResult {
  ir_id: string;
  deleted: boolean;
}
export interface ItemReorderPayload {
  ir_id: string;
  ir_branch_id: string | null;
  ir_item_id: string;
  ir_unit_id: string | null;
  ir_godown_id: string | null;
  ir_min_level: number;
  ir_max_level: number;
  ir_reorder_level: number;
  ir_reorder_qty: number;
  ir_lead_time_days: number;
  ir_review_cycle_days: number;
  ir_reorder_days: number;
  ir_expiry_buffer_days: number;
  ir_reorder_type: string;
  ir_is_active: boolean;
  ir_is_deleted: boolean;
  ir_remarks: string | null;
  ir_created_on: string;
  ir_created_by: string | null;
  ir_modified_on: string;
  ir_modified_by: string | null;
  // Resolved names for the foreign-key ids above (populated by the item composite get endpoint).
  ir_branch_name?: string | null;
  // ir_unit_id holds an iuc_id, so the underlying unit-master id is surfaced separately.
  ir_unit_master_id?: string | null;
  ir_unit_name?: string | null;
  ir_godown_name?: string | null;
}
export type ItemReorderListItem = ItemReorderPayload | Record<string, unknown>;