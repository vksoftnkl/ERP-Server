export type { FixedErrorDetail as GridDetailErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as GridDetailErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as GridDetailSuccessResponse } from 'src/common/types/module-api.types';

export interface GridColumnPayload {
  grid_column_id: string;
  grid_id: string;
  grid_column_number: number;
  grid_column_name: string;
  grid_column_width: number | null;
  grid_column_position: number | null;
  grid_column_alignment: string | null;
  grid_column_visibility: boolean;
  grid_column_filter: boolean;
  grid_column_condition: string | null;
  grid_column_condition_color: string | null;
  grid_column_group: boolean;
  grid_column_total: boolean;
  grid_column_data_type: string | null;
  grid_column_color: string | null;
  grid_column_notes: string | null;
  grid_column_sql_field_name: string | null;
  grid_column_is_deleted: boolean;
}

export interface GridDetailPayload {
  grid_id: string;
  grid_name: string;
  grid_description: string | null;
  grid_sort_column: string | null;
  grid_sort_order: string | null;
  grid_sql: string | null;
  grid_status: boolean;
  grid_device_type: string | null;
  grid_is_deleted: boolean;
  columns: GridColumnPayload[];
}

export type GridDetailListItem = GridDetailPayload | Record<string, unknown>;
