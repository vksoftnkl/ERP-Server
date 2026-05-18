export type { InventoryErrorDetail as ItemSectionErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemSectionErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as ItemSectionSuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as ItemSectionListMeta } from 'src/common/types/module-list.types';
export interface ItemSectionPayload {
  sec_id: string;
  sec_name: string;
  sec_alias: string | null;
  sec_short: string | null;
  sec_description: string | null;
  sec_parent_id: string | null;
  sec_sort: number | null;
  sec_level: number | null;
  sec_path_ids: string[];
  sec_position: number | null;
  sec_color_code: string | null;
  sec_icon: string | null;
  sec_photo: string | null;
  sec_photo_url: string | null;
  sec_sync_date: string | null;
  sec_is_active: boolean;
  sec_is_deleted: boolean;
  sec_created_on: string;
  sec_created_by: string | null;
  sec_modified_on: string;
  sec_modified_by: string | null;
}

export interface ItemSectionDefaultListItem {
  sec_id: string;
  sec_name: string;
}

export type ItemSectionListItem = ItemSectionDefaultListItem | Record<string, unknown>;
