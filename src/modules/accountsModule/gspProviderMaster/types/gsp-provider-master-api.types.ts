export type { AccountsErrorDetail as GspProviderMasterErrorDetail } from '../../utils/accounts-api.types';
export type { AccountsErrorResponse as GspProviderMasterErrorResponse } from '../../utils/accounts-api.types';
export type { AccountsSuccessResponse as GspProviderMasterSuccessResponse } from '../../utils/accounts-api.types';
export type { AccountsListMeta as GspProviderMasterListMeta } from '../../utils/accounts-list.utils';

export interface GspProviderMasterPayload {
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

export type GspProviderMasterListItem = GspProviderMasterPayload | Record<string, unknown>;
