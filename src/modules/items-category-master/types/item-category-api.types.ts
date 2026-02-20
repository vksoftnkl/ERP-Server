export interface ItemCategoryErrorDetail {
  field: string;
  message: string;
}

export interface ItemCategoryErrorResponse {
  success: false;
  message: string;
  errors: ItemCategoryErrorDetail[];
}

export interface ItemCategorySuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export type ItemCategoryListItem = ItemCategoryPayload | Record<string, unknown>;

export interface ItemCategoryListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
