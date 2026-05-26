export type { AccountsErrorDetail as CompanyGroupMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as CompanyGroupMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as CompanyGroupMasterSuccessResponse } from 'src/common/types/module-api.types';

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
