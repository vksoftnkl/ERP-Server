export type { AccountsErrorDetail as CompanyGroupMasterErrorDetail } from '../../utils/accounts-api.types';
export type { AccountsErrorResponse as CompanyGroupMasterErrorResponse } from '../../utils/accounts-api.types';
export type { AccountsSuccessResponse as CompanyGroupMasterSuccessResponse } from '../../utils/accounts-api.types';
export type { AccountsListMeta as CompanyGroupMasterListMeta } from '../../utils/accounts-list.utils';

export interface CompanyGroupMasterPayload {
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

export type CompanyGroupMasterListItem = CompanyGroupMasterPayload | Record<string, unknown>;
