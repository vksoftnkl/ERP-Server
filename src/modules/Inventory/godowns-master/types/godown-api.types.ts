export type { InventoryErrorDetail as GodownErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as GodownErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as GodownSuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as GodownListMeta } from 'src/common/types/module-list.types';
export interface GodownPayload {
  gdl_id: string;
  gdl_godown_id: string;
  gdl_branch_id: string;
  gdl_name: string;
  gdl_short: string | null;
  gdl_code: string | null;
  gdl_type: string;
  gdl_parent_id: string | null;
  gdl_sort: number;
  gdl_level: number;
  gdl_path_ids_cache: string[];
  gdl_del_sheet: boolean;
  gdl_split_stock: boolean;
  gdl_negative_stock: boolean;
  gdl_volume: number;
  gdl_is_active: boolean;
  gdl_is_deleted: boolean;
  gdl_created_on: string;
  gdl_created_by: string | null;
  gdl_modified_on: string;
  gdl_modified_by: string | null;
  gdl_remarks: string | null;
}
export type GodownListItem = GodownPayload | Record<string, unknown>;
