export interface DropdownColumnErrorDetail {
  field: string;
  message: string;
}
export interface DropdownColumnErrorResponse {
  success: false;
  message: string;
  errors: DropdownColumnErrorDetail[];
}
export interface DropdownColumnSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}
export interface DropdownColumnPayload {
  drop_columns_serial_id: string;
  dropdown_id: string;
  drop_columns_column_no: number;
  drop_columns_data_type: string;
  drop_columns_column_name: string;
  drop_columns_column_alias: string | null;
  drop_columns_column_width: number | null;
  drop_columns_column_visiblity: boolean;
  drop_columns_column_allignment: string | null;
  drop_columns_column_filter: boolean;
  drop_columns_created_on: string;
  drop_columns_modified_on: string | null;
}
export interface DropdownColumnListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
