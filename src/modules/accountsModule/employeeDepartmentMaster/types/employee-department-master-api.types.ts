export interface EmployeeDepartmentMasterErrorDetail {
  field: string;
  message: string;
}

export interface EmployeeDepartmentMasterErrorResponse {
  success: false;
  message: string;
  errors: EmployeeDepartmentMasterErrorDetail[];
}

export interface EmployeeDepartmentMasterSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

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

export type EmployeeDepartmentMasterListItem =
  | EmployeeDepartmentMasterPayload
  | Record<string, unknown>;

export interface EmployeeDepartmentMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
