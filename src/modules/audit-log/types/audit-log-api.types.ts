export interface AuditLogErrorDetail {
  field: string;
  message: string;
}

export interface AuditLogErrorResponse {
  success: false;
  message: string;
  errors: AuditLogErrorDetail[];
}

export interface AuditLogSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface AuditLogListItem {
  log_id: string;
  log_date: string;
  log_action: string;
  log_screen_id: number;
  screen_name: string;
  log_table_name: string;
  log_pk: string | null;
  log_display_name: string | null;
  log_original_record: unknown;
  log_modified_record: unknown;
  log_changed_fields: unknown;
  log_user_id: string | null;
  log_user_name: string | null;
  log_branch_id: string | null;
  log_branch_name: string | null;
  log_notes: string | null;
}

export interface AuditLogListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
