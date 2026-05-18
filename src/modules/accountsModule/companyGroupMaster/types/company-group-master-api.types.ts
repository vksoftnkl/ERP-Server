export type { AccountsErrorDetail as CompanyGroupMasterErrorDetail } from 'src/common/utils/module-api.types';
export type { AccountsErrorResponse as CompanyGroupMasterErrorResponse } from 'src/common/utils/module-api.types';
export type { AccountsSuccessResponse as CompanyGroupMasterSuccessResponse } from 'src/common/utils/module-api.types';
export type { AccountsListMeta as CompanyGroupMasterListMeta } from 'src/common/utils/module-list.utils';

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
