export declare class CompanyGroupMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class CompanyGroupMasterErrorResponseDto {
    success: false;
    message: string;
    errors: CompanyGroupMasterErrorFieldDto[];
}
export declare class CompanyGroupMasterPayloadDto {
    cogGroupId: string;
    cogGroupName: string;
    cogCompanyIds: string[];
    cogIsActive: boolean;
    cogIsDeleted: boolean;
    cogSyncDate: string | null;
    cogCreatedOn: string;
    cogCreatedBy: string | null;
    cogModifiedOn: string;
    cogModifiedBy: string | null;
}
export declare class CompanyGroupMasterDeleteResultDto {
    cogGroupId: string;
    deleted: true;
}
export declare class CompanyGroupMasterSuccessSingleDto {
    success: true;
    message: string;
    data: CompanyGroupMasterPayloadDto;
}
export declare class CompanyGroupMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: CompanyGroupMasterDeleteResultDto;
}
