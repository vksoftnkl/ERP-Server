export declare class SaveUserLoginSessionDto {
    ulsId?: string;
    ulsCompanyId?: string | null;
    ulsBranchId?: string | null;
    ulsUserId: string;
    ulsDeviceId?: string | null;
    ulsSessionId?: string | null;
    ulsSessionToken?: string | null;
    ulsRefreshTokenId?: string | null;
    ulsLoginOn?: Date;
    ulsLogoutOn?: Date | null;
    ulsLogoutType?: string | null;
    ulsLoginStatus?: string;
    ulsFailReason?: string | null;
    ulsIpAddress?: string | null;
    ulsUserAgent?: string | null;
    ulsAppVersion?: string | null;
    ulsIsActiveSession?: boolean;
    ulsIsActive?: boolean;
    ulsCreatedBy?: string | null;
    ulsModifiedBy?: string | null;
}
