export type { FixedErrorDetail as UserLoginSessionsErrorDetail } from 'src/common/utils/module-api.types';
export type { FixedErrorResponse as UserLoginSessionsErrorResponse } from 'src/common/utils/module-api.types';
export type { FixedSuccessResponse as UserLoginSessionsSuccessResponse } from 'src/common/utils/module-api.types';
export type { FixedListMeta as UserLoginSessionsListMeta } from 'src/common/utils/module-list.utils';

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
