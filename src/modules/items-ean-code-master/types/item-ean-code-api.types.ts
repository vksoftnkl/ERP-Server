export interface ItemEanCodeErrorDetail {
  field: string;
  message: string;
}

export interface ItemEanCodeErrorResponse {
  success: false;
  message: string;
  errors: ItemEanCodeErrorDetail[];
}

export interface ItemEanCodeSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface ItemEanCodeDeleteResult {
  ean_id: string;
  deleted: true;
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
}

export type ItemEanCodeListItem = ItemEanCodePayload | Record<string, unknown>;

export interface ItemEanCodeListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
