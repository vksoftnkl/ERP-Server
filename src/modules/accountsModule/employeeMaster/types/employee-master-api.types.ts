export interface EmployeeMasterErrorDetail {
  field: string;
  message: string;
}

export interface EmployeeMasterErrorResponse {
  success: false;
  message: string;
  errors: EmployeeMasterErrorDetail[];
}

export interface EmployeeMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface EmployeeMasterPayload {
  empId: string;
  empCompanyId: number;
  empBranchId: string | null;
  empCode: string | null;
  empName: string;
  empAlias: string | null;
  empMobile1: string | null;
  empMobile2: string | null;
  empEmail: string | null;
  empAddr1: string | null;
  empAddr2: string | null;
  empAddr3: string | null;
  empCity: string | null;
  empDistrict: string | null;
  empState: string | null;
  empPincode: string | null;
  empGender: string | null;
  empMaritalStatus: string | null;
  empBloodGroup: string | null;
  empDob: string | null;
  empDepartmentId: string | null;
  empDesignationId: string | null;
  empEmploymentType: string | null;
  empStatus: string | null;
  empJoinedOn: string | null;
  empProbationEndOn: string | null;
  empConfirmationOn: string | null;
  empLeftOn: string | null;
  empShiftId: string | null;
  empAttConstraintId: string | null;
  empHolidayGroupId: string | null;
  empOvertimeAllowed: boolean;
  empHasCommission: boolean;
  empCommissionType: string | null;
  empCommissionValue: number | null;
  empSalaryType: string;
  empSalaryAmount: number;
  empBataAmount: number;
  empKmBataAmount: number;
  empPanNo: string | null;
  empAadharNo: string | null;
  empPfNo: string | null;
  empEsiNo: string | null;
  empLoanLedgerId: string | null;
  empPhotoUrl: string | null;
  empPhoto: string | null;
  empRemarks: string | null;
  empIsActive: boolean;
  empIsDeleted: boolean;
  empSyncDate: string | null;
  empCreatedOn: string;
  empCreatedBy: string | null;
  empModifiedOn: string;
  empModifiedBy: string | null;
}

export type EmployeeMasterListItem = EmployeeMasterPayload | Record<string, unknown>;

export interface EmployeeMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
