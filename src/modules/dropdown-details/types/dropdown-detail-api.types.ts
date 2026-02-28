export interface DropdownDetailErrorDetail {
  field: string;
  message: string;
}

export interface DropdownDetailErrorResponse {
  success: false;
  message: string;
  errors: DropdownDetailErrorDetail[];
}

export interface DropdownDetailSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface DropdownDetailPayload {
  dropdown_id: string;
  dropdown_name: string;
  dropdown_description: string | null;
  dropdown_sql: string;
  dropdown_sort_order: string | null;
  dropdown_sort_column: string | null;
  dropdown_completion: string | null;
  dropdown_sql_regional: string | null;
  dropdown_max_visible_items: number;
  dropdown_show_header: boolean;
  dropdown_width: number | null;
}

export interface DropdownDetailListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
