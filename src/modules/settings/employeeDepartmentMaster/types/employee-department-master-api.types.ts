import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
export type EmployeeDepartmentMasterErrorDetail = ModuleApiErrorDetail;
export type EmployeeDepartmentMasterErrorResponse =
  ModuleApiErrorResponse<EmployeeDepartmentMasterErrorDetail>;
export type EmployeeDepartmentMasterSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

export interface EmployeeDepartmentMasterPayload {
  edptId: string;
  edptName: string;
  edptCode: string | null;
  edptAlias: string | null;
  edptRemarks: string | null;
  edptIsActive: boolean;
  edptIsDeleted: boolean;
  edptSyncDate: string | null;
  edptCreatedOn: string;
  edptCreatedBy: string | null;
  edptModifiedOn: string;
  edptModifiedBy: string | null;
}
