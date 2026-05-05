export interface ItemBrandErrorDetail {
  field: string;
  message: string;
}
export interface ItemBrandErrorResponse {
  success: false;
  message: string;
  errors: ItemBrandErrorDetail[];
}
export interface ItemBrandSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}
export interface ItemBrandPayload {
  brand_id: string;
  brand_name: string;
  brand_alias: string | null;
  brand_short: string | null;
  brand_description: string | null;
  brand_photo: string | null;
  brand_photo_url: string | null;
  brand_parent_id: string | null;
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
export type ItemBrandListItem = ItemBrandPayload | Record<string, unknown>;
export interface ItemBrandListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
