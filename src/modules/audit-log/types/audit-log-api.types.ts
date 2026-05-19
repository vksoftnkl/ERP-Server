import type { Prisma } from '@prisma/client';
import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';

export type AuditLogErrorDetail = ModuleApiErrorDetail;
export type AuditLogErrorResponse = ModuleApiErrorResponse<AuditLogErrorDetail>;
export type AuditLogSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;

export interface AuditLogListItem {
  log_id: string;
  log_date: string;
  log_action: string;
  log_screen_id: number;
  screen_name: string;
  log_table_name: string;
  log_pk: string | null;
  log_display_name: string | null;
  log_original_record: Prisma.JsonValue | null;
  log_modified_record: Prisma.JsonValue | null;
  log_changed_fields: Prisma.JsonValue | null;
  log_user_id: string | null;
  log_user_name: string | null;
  log_branch_id: string | null;
  log_branch_name: string | null;
  log_notes: string | null;
}

export interface AuditLogListMeta {
  page: number | null;
  limit: number;
  total: number | null;
  total_pages: number | null;
  next_cursor: string | null;
}
