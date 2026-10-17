export declare class EmployeeDepartmentMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class EmployeeDepartmentMasterErrorResponseDto {
    success: false;
    message: string;
    errors: EmployeeDepartmentMasterErrorFieldDto[];
}
export declare class EmployeeDepartmentMasterPayloadDto {
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
export declare class EmployeeDepartmentMasterDeleteResultDto {
    edptId: string;
    deleted: true;
}
export declare class EmployeeDepartmentMasterSuccessSingleDto {
    success: true;
    message: string;
    data: EmployeeDepartmentMasterPayloadDto;
}
export declare class EmployeeDepartmentMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: EmployeeDepartmentMasterDeleteResultDto;
}
