export type { FixedErrorDetail as DropdownDetailErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as DropdownDetailErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as DropdownDetailSuccessResponse } from 'src/common/types/module-api.types';

export interface DropdownColumnPayload {
  drop_columns_id: string;
  dropdown_id: string;
  drop_columns_column_no: number;
  drop_columns_data_type: string;
  drop_columns_column_name: string;
  drop_columns_column_alias: string | null;
  drop_columns_column_width: number | null;
  drop_columns_column_visiblity: boolean;
  drop_columns_column_allignment: string | null;
  drop_columns_column_filter: boolean;
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
  columns: DropdownColumnPayload[];
}

export type DropdownDetailListItem = DropdownDetailPayload | Record<string, unknown>;
