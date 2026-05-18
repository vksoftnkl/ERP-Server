import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type EmployeeDesignationMasterErrorDetail = ModuleApiErrorDetail;
export type EmployeeDesignationMasterErrorResponse = ModuleApiErrorResponse<EmployeeDesignationMasterErrorDetail>;
export type EmployeeDesignationMasterSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type EmployeeDesignationMasterListMeta = ModuleListMeta;

export interface EmployeeDesignationMasterPayload {
  edId: string;
  edName: string;
  edCode: string | null;
  edIsDefault: boolean;
  edRemarks: string | null;
  edIsActive: boolean;
  edIsDeleted: boolean;
  edSyncDate: string | null;
  edCreatedOn: string;
  edCreatedBy: string | null;
  edModifiedOn: string;
  edModifiedBy: string | null;
}

export type EmployeeDesignationMasterListItem =
  | EmployeeDesignationMasterPayload
  | Record<string, unknown>;

