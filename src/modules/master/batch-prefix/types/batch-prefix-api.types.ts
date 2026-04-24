export interface BatchPrefixErrorDetail {
  field: string;
  message: string;
}
export interface BatchPrefixErrorResponse {
  success: false;
  message: string;
  errors: BatchPrefixErrorDetail[];
}
export interface BatchPrefixSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}
export interface BatchPrefixPayload {
  id: string;
  prefixUsed: string | null;
  syncDate: string | null;
  createdBy: string | null;
  createdOn: string | null;
  modifiedBy: string | null;
  modifiedOn: string | null;
}
export type BatchPrefixListItem = BatchPrefixPayload | Record<string, unknown>;
export interface BatchPrefixListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
export interface BatchPrefixDeleteResult {
  id: string;
  deleted: true;
}
