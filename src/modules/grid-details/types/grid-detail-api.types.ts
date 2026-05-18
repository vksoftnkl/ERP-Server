import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type GridDetailErrorDetail = ModuleApiErrorDetail;
export type GridDetailErrorResponse = ModuleApiErrorResponse<GridDetailErrorDetail>;
export type GridDetailSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;
export type GridDetailListMeta = ModuleListMeta;

export interface GridDetailPayload {
  grid_id: string;
  grid_name: string;
  grid_description: string | null;
  grid_sort_column: string | null;
  grid_sort_order: string | null;
  grid_sql: string | null;
  grid_status: boolean;
  grid_is_deleted: boolean;
}
