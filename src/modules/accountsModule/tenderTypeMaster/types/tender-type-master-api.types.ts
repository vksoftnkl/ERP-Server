export type { AccountsErrorDetail as TenderTypeMasterErrorDetail } from 'src/common/utils/module-api.types';
export type { AccountsErrorResponse as TenderTypeMasterErrorResponse } from 'src/common/utils/module-api.types';
export type { AccountsSuccessResponse as TenderTypeMasterSuccessResponse } from 'src/common/utils/module-api.types';
export type { AccountsListMeta as TenderTypeMasterListMeta } from 'src/common/utils/module-list.utils';
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