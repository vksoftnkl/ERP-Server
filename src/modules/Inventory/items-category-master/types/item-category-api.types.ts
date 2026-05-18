export type { InventoryErrorDetail as ItemCategoryErrorDetail } from 'src/common/utils/module-api.types';
export type { InventoryErrorResponse as ItemCategoryErrorResponse } from 'src/common/utils/module-api.types';
export type { InventorySuccessResponse as ItemCategorySuccessResponse } from 'src/common/utils/module-api.types';
export type { InventoryListMeta as ItemCategoryListMeta } from 'src/common/utils/module-list.utils';
export interface ItemCategoryPayload {
  category_id: string;
  category_name: string;
  category_alias: string | null;
  category_short: string | null;
  category_description: string | null;
  category_parent_id: string | null;
  category_sort: number | null;
  category_level: number | null;
  category_path_ids_cache: string[];
  category_tax_claim: boolean | null;
  category_default_tax_id: string | null;
  category_default_hsn: string | null;
  category_default_uom_id: string | null;
  category_photo: string | null;
  category_photo_url: string | null;
  category_sync_date: string | null;
  category_is_active: boolean;
  category_is_deleted: boolean;
  category_created_on: string;
  category_created_by: string | null;
  category_modified_on: string;
  category_modified_by: string | null;
}

export interface ItemCategoryDefaultListItem {
  category_id: string;
  category_name: string;
}

export type ItemCategoryListItem = ItemCategoryDefaultListItem | Record<string, unknown>;
