export type { InventoryErrorDetail as ItemEanCodeErrorDetail } from 'src/common/types/module-api.types';
export type { InventoryErrorResponse as ItemEanCodeErrorResponse } from 'src/common/types/module-api.types';
export type { InventorySuccessResponse as ItemEanCodeSuccessResponse } from 'src/common/types/module-api.types';
export type { InventoryListMeta as ItemEanCodeListMeta } from 'src/common/utils/module-list.utils';
export interface ItemEanCodeDeleteResult {
  ean_id: string;
  deleted: boolean;
}

export interface ItemEanCodePayload {
  ean_id: string;
  ean_item_id: string;
  ean_unit_id: string;
  ean_code: string;
  ean_godown_id: string | null;
  ean_is_default: boolean;
  ean_is_active: boolean;
  ean_is_deleted: boolean;
  ean_created_on: string;
  ean_created_by: string | null;
  ean_modified_on: string;
  ean_modified_by: string | null;
  ean_remarks: string | null;
  // Resolved names for the foreign-key ids above (populated by the item composite get endpoint).
  ean_unit_name?: string | null;
  ean_godown_name?: string | null;
}

export type ItemEanCodeListItem = ItemEanCodePayload | Record<string, unknown>;
