import type { AccLedgerProfile, AccGroupMasterNature, AccGroupMasterType } from './acc-group-master-enum';

export type { AccountsErrorDetail as AccGroupMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as AccGroupMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as AccGroupMasterSuccessResponse } from 'src/common/types/module-api.types';
export { AccLedgerProfile, AccGroupMasterNature, AccGroupMasterType } from './acc-group-master-enum';

export interface AccGroupMasterPayload {
  accGroupId: string;
  accGroupCompanyId: string | null;
  accGroupCompanyName: string | null;
  accGroupName: string;
  accGroupAlias: string | null;
  accGroupShort: string | null;
  accGroupDescription: string | null;
  accGroupTallyName: string | null;
  accGroupPrimaryName: string | null;
  accGroupNature: AccGroupMasterNature | null;
  accLedgerProfile: AccLedgerProfile;
  accGroupTallyGuid: string | null;
  accGroupTallyMasterId: string | null;
  accGroupTallyAlterId: string | null;
  accGroupParentId: string | null;
  accGroupParentName: string | null;
  accGroupSort: number | null;
  accGroupChildIds: string[];
  accGroupType: AccGroupMasterType;
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
