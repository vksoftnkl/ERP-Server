export interface GridColumnErrorDetail {
  field: string;
  message: string;
}

export interface GridColumnErrorResponse {
  success: false;
  message: string;
  errors: GridColumnErrorDetail[];
}

export interface GridColumnSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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
  grid_column_is_deleted: boolean;
}

export interface GridColumnListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
