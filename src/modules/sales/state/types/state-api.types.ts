export interface StateErrorDetail {
  field: string;
  message: string;
}

export interface StateErrorResponse {
  success: false;
  message: string;
  errors: StateErrorDetail[];
}

export interface StateSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface StatePayload {
  stmId: string;
  stmName: string;
  stmAlias: string | null;
  stmShort: string | null;
  stmOrder: number;
  stmIsActive: boolean;
  stmIsDeleted: boolean;
  stmSyncDate: string | null;
  stmCreatedOn: string;
  stmCreatedBy: string | null;
  stmModifiedOn: string;
  stmModifiedBy: string | null;
}

export type StateListItem = StatePayload | Record<string, unknown>;

export interface StateListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
