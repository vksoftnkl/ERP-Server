export interface GridDetailErrorDetail {
  field: string;
  message: string;
}

export interface GridDetailErrorResponse {
  success: false;
  message: string;
  errors: GridDetailErrorDetail[];
}

export interface GridDetailSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface GridDetailPayload {
  grid_id: string;
  grid_name: string;
  grid_description: string | null;
  grid_sort_column: number | null;
  grid_sort_order: number | null;
  grid_sql: string | null;
  grid_status: boolean;
  grid_is_deleted: boolean;
}

export interface GridDetailListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
