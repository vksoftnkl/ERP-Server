import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type BatchPrefixErrorDetail = ModuleApiErrorDetail;
export type BatchPrefixErrorResponse = ModuleApiErrorResponse<BatchPrefixErrorDetail>;
export type BatchPrefixSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type BatchPrefixListMeta = ModuleListMeta;

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
export interface BatchPrefixDeleteResult {
  id: string;
  deleted: true;
}
