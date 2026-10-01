export declare class EmployeeMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class EmployeeMasterErrorResponseDto {
    success: false;
    message: string;
    errors: EmployeeMasterErrorFieldDto[];
}
export declare class EmployeeMasterPayloadDto {
    empId: string;
    empCompanyId: number;
    empCompanyName?: string | null;
    empBranchId: string | null;
    empBranchName?: string | null;
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
    empDepartmentName?: string | null;
    empDesignationId: string | null;
    empDesignationName?: string | null;
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
export declare class EmployeeMasterDeleteResultDto {
    empId: string;
    deleted: true;
}
export declare class EmployeeMasterSuccessSingleDto {
    success: true;
    message: string;
    data: EmployeeMasterPayloadDto;
}
export declare class EmployeeMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: EmployeeMasterDeleteResultDto;
}
