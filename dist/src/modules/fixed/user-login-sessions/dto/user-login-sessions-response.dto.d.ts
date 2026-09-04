import { FixedErrorFieldDto, FixedErrorResponseDto, FixedListMetaDto } from "../../../../common/utils/module-response.dto";
export { FixedErrorFieldDto as UserLoginSessionsErrorFieldDto };
export { FixedErrorResponseDto as UserLoginSessionsErrorResponseDto };
export { FixedListMetaDto as UserLoginSessionsListMetaDto };
export declare class UserLoginSessionsPayloadDto {
    ulsId: string;
    ulsCompanyId: string | null;
    ulsBranchId: string | null;
    ulsUserId: string;
    ulsDeviceId: string | null;
    ulsSessionId: string | null;
    ulsSessionToken: string | null;
    ulsRefreshTokenId: string | null;
    ulsLoginOn: string;
    ulsLogoutOn: string | null;
    ulsLogoutType: string | null;
    ulsLoginStatus: string;
    ulsFailReason: string | null;
    ulsIpAddress: string | null;
    ulsUserAgent: string | null;
    ulsAppVersion: string | null;
    ulsIsActiveSession: boolean;
    ulsIsActive: boolean;
    ulsIsDeleted: boolean;
    ulsSyncDate: string | null;
    ulsCreatedOn: string;
    ulsCreatedBy: string | null;
    ulsModifiedOn: string;
    ulsModifiedBy: string | null;
}
export declare class UserLoginSessionsDeleteResultDto {
    ulsId: string;
    deleted: true;
}
export declare class UserLoginSessionsSuccessSingleDto {
    success: true;
    message: string;
    data: UserLoginSessionsPayloadDto;
}
export declare class UserLoginSessionsSuccessListDto {
    success: true;
    message: string;
    data: UserLoginSessionsPayloadDto[];
    meta: FixedListMetaDto;
}
export declare class UserLoginSessionsSuccessDeleteDto {
    success: true;
    message: string;
    data: UserLoginSessionsDeleteResultDto;
}
