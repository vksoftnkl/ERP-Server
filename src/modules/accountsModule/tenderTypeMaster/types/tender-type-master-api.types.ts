export type { AccountsErrorDetail as TenderTypeMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as TenderTypeMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as TenderTypeMasterSuccessResponse } from 'src/common/types/module-api.types';
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
