import type { AccountGroupType } from './account-group-enum';

export type { AccountsErrorDetail as AccountGroupErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as AccountGroupErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as AccountGroupSuccessResponse } from 'src/common/types/module-api.types';
export { AccountGroupNature, AccountGroupType } from './account-group-enum';

export interface AccountGroupPayload {
  accGroupId: string;
  accGroupCompanyId: string | null;
  accGroupName: string;
  accGroupAlias: string | null;
  accGroupShort: string | null;
  accGroupDescription: string | null;
  accGroupTallyName: string | null;
  accGroupPrimaryName: string | null;
  accGroupNature: string | null;
  accGroupTallyGuid: string | null;
  accGroupTallyMasterId: string | null;
  accGroupTallyAlterId: string | null;
  accGroupParentId: string | null;
  accGroupParentName: string | null;
  accGroupSort: number | null;
  accGroupChildIds: string[];
  accGroupType: AccountGroupType;
  accGroupIsDefault: boolean;
  accGroupIsReserved: boolean;
  accGroupBehaveAsSubledger: boolean;
  accGroupNetDebitCredit: boolean;
  accGroupUsedForCalculation: boolean;
  accGroupAffectsGrossProfit: boolean;
  accGroupIsActive: boolean;
  accGroupIsDeleted: boolean;
  accGroupSyncDate: string | null;
  accGroupCreatedOn: string;
  accGroupCreatedBy: string | null;
  accGroupModifiedOn: string;
  accGroupModifiedBy: string | null;
}
