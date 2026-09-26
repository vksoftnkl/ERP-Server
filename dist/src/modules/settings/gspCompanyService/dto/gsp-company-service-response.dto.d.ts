export declare class GspCompanyServiceErrorFieldDto {
    field: string;
    message: string;
}
export declare class GspCompanyServiceErrorResponseDto {
    success: false;
    message: string;
    errors: GspCompanyServiceErrorFieldDto[];
}
export declare class GspCompanyServicePayloadDto {
    csgCompanyServiceId: string;
    csgCompanyId: string;
    companyName: string | null;
    companyDisplay: string | null;
    csgGspProviderId: string;
    providerName: string | null;
    providerDisplay: string | null;
    csgServiceType: string;
    csgEuserName: string;
    csgEuserPassword: string;
    csgAuthToken: string | null;
    csgAuthTokenValidTill: string | null;
    csgIsActive: boolean;
    csgIsDeleted: boolean;
    csgSyncDate: string | null;
    csgCreatedOn: string;
    csgCreatedBy: string | null;
    csgModifiedOn: string;
    csgModifiedBy: string | null;
}
export declare class GspCompanyServiceDeleteResultDto {
    csgCompanyServiceId: string;
    deleted: true;
}
export declare class GspCompanyServiceSuccessSingleDto {
    success: true;
    message: string;
    data: GspCompanyServicePayloadDto;
}
export declare class GspCompanyServiceSuccessDeleteDto {
    success: true;
    message: string;
    data: GspCompanyServiceDeleteResultDto;
}
