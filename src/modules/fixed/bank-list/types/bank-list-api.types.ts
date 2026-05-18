export type { FixedErrorDetail as BankListErrorDetail } from 'src/common/utils/module-api.types';
export type { FixedErrorResponse as BankListErrorResponse } from 'src/common/utils/module-api.types';
export type { FixedSuccessResponse as BankListSuccessResponse } from 'src/common/utils/module-api.types';
export type { FixedListMeta as BankListMeta } from 'src/common/utils/module-list.utils';

export interface BankListPayload {
  bnkId: string;
  bnkName: string;
  bnkShortName: string | null;
  bnkAlias: string | null;
  bnkRbiCode: string | null;
  bnkIbanSupported: boolean;
  bnkIsActive: boolean;
  bnkIsDeleted: boolean;
  bnkSyncDate: string | null;
  bnkCreatedOn: string;
  bnkCreatedBy: string | null;
  bnkModifiedOn: string;
  bnkModifiedBy: string | null;
}

export type BankListItem = BankListPayload | Record<string, unknown>;
