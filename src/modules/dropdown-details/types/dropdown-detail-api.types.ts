export type { FixedErrorDetail as DropdownDetailErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as DropdownDetailErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as DropdownDetailSuccessResponse } from 'src/common/types/module-api.types';

export interface DropdownColumnPayload {
  dropdown_columns_id: string;
  dropdown_columns_dropdown_id: string;
  dropdown_columns_no: number;
  dropdown_columns_data_type: string;
  dropdown_columns_name: string;
  dropdown_columns_alias: string | null;
  dropdown_columns_width: number | null;
  dropdown_columns_visiblity: boolean;
  dropdown_columns_allignment: string | null;
  dropdown_columns_filter: boolean;
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
  dropdown_device_type: string | null;
  columns: DropdownColumnPayload[];
}

export type DropdownDetailListItem = DropdownDetailPayload | Record<string, unknown>;
