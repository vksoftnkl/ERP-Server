export declare class EmployeeDesignationMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class EmployeeDesignationMasterErrorResponseDto {
    success: false;
    message: string;
    errors: EmployeeDesignationMasterErrorFieldDto[];
}
export declare class EmployeeDesignationMasterPayloadDto {
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
export declare class EmployeeDesignationMasterDeleteResultDto {
    edId: string;
    deleted: true;
}
export declare class EmployeeDesignationMasterSuccessSingleDto {
    success: true;
    message: string;
    data: EmployeeDesignationMasterPayloadDto;
}
export declare class EmployeeDesignationMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: EmployeeDesignationMasterDeleteResultDto;
}
