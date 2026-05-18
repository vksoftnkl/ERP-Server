export type { AccountsErrorDetail as TenderTypeMasterErrorDetail } from '../../utils/accounts-api.types';
export type { AccountsErrorResponse as TenderTypeMasterErrorResponse } from '../../utils/accounts-api.types';
export type { AccountsSuccessResponse as TenderTypeMasterSuccessResponse } from '../../utils/accounts-api.types';
export type { AccountsListMeta as TenderTypeMasterListMeta } from '../../utils/accounts-list.utils';
export interface TenderTypeMasterPayload {
  ttmTypeId: string;
  ttmTypeName: string;
  ttmIsActive: boolean;
  ttmIsDeleted: boolean;
  ttmSyncDate: string | null;
  ttmCreatedOn: string;
  ttmCreatedBy: string | null;
  ttmModifiedOn: string;
  ttmModifiedBy: string | null;
}
export type TenderTypeMasterListItem = TenderTypeMasterPayload | Record<string, unknown>;