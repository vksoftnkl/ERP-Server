import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type GridColumnErrorDetail = ModuleApiErrorDetail;
export type GridColumnErrorResponse = ModuleApiErrorResponse<GridColumnErrorDetail>;
export type GridColumnSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;
export type GridColumnListMeta = ModuleListMeta;

export interface GridColumnPayload {
  grid_serialid: string;
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

