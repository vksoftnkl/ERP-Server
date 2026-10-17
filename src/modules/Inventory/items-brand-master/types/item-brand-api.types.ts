export type { InventoryErrorDetail as ItemBrandErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemBrandErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as ItemBrandSuccessResponse } from 'src/common/types/module-api.types';
export interface ItemBrandPayload {
  brand_id: string;
  brand_name: string;
  brand_alias: string | null;
  brand_short: string | null;
  brand_description: string | null;
  brand_photo: string | null;
  brand_photo_url: string | null;
  brand_parent_id: string | null;
  brand_parent_name: string | null;
  brand_sort: number | null;
  brand_level: number | null;
  brand_path_ids: string[];
  brand_is_active: boolean;
  brand_is_deleted: boolean;
  brand_sync_date: string | null;
  brand_created_on: string;
  brand_created_by: string | null;
  brand_modified_on: string;
  brand_modified_by: string | null;
}
