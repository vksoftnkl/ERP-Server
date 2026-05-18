import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type DropdownColumnErrorDetail = ModuleApiErrorDetail;
export type DropdownColumnErrorResponse = ModuleApiErrorResponse<DropdownColumnErrorDetail>;
export type DropdownColumnSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;
export type DropdownColumnListMeta = ModuleListMeta;

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
