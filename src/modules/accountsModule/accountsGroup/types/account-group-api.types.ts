export interface AccountGroupErrorDetail {
  field: string;
  message: string;
}

export interface AccountGroupErrorResponse {
  success: false;
  message: string;
  errors: AccountGroupErrorDetail[];
}

export interface AccountGroupSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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
  accGroupParentId: string | null;
  accGroupSort: number | null;
  accGroupChildIds: string[];
  accGroupTypeCode: string;
  accGroupIsDefault: boolean;
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

export type AccountGroupListItem = AccountGroupPayload | Record<string, unknown>;

export interface AccountGroupListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
