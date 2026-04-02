export interface UserLoginSessionsErrorDetail {
  field: string;
  message: string;
}

export interface UserLoginSessionsErrorResponse {
  success: false;
  message: string;
  errors: UserLoginSessionsErrorDetail[];
}

export interface UserLoginSessionsSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface UserLoginSessionsPayload {
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

export type UserLoginSessionsListItem = UserLoginSessionsPayload | Record<string, unknown>;

export interface UserLoginSessionsListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
