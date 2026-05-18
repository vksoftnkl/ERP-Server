export type { AccountsErrorDetail as GspProviderMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as GspProviderMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as GspProviderMasterSuccessResponse } from 'src/common/types/module-api.types';
export type { AccountsListMeta as GspProviderMasterListMeta } from 'src/common/types/module-list.types';

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
