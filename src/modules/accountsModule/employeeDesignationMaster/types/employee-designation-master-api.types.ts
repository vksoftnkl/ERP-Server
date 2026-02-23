export interface EmployeeDesignationMasterErrorDetail {
  field: string;
  message: string;
}

export interface EmployeeDesignationMasterErrorResponse {
  success: false;
  message: string;
  errors: EmployeeDesignationMasterErrorDetail[];
}

export interface EmployeeDesignationMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export interface EmployeeDesignationMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
