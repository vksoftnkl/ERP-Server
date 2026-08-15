export declare class GspProviderMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class GspProviderMasterErrorResponseDto {
    success: false;
    message: string;
    errors: GspProviderMasterErrorFieldDto[];
}
export declare class GspProviderMasterPayloadDto {
    gspProviderId: string;
    gspProviderCode: string;
    gspProviderName: string;
    gspBaseUrl: string;
    gspRoute: string;
    gspIpAddress: string;
    gspUserName: string;
    gspUserPassword: string;
    gspIsActive: boolean;
    gspIsDeleted: boolean;
    gspCreatedOn: string;
    gspCreatedBy: string | null;
    gspModifiedOn: string;
    gspModifiedBy: string | null;
}
export declare class GspProviderMasterDeleteResultDto {
    gspProviderId: string;
    deleted: true;
}
export declare class GspProviderMasterSuccessSingleDto {
    success: true;
    message: string;
    data: GspProviderMasterPayloadDto;
}
export declare class GspProviderMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: GspProviderMasterDeleteResultDto;
}
