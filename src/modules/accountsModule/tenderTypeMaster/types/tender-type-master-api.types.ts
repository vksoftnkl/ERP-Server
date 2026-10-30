export type { AccountsErrorDetail as TenderTypeMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as TenderTypeMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as TenderTypeMasterSuccessResponse } from 'src/common/types/module-api.types';
export interface TenderTypeMasterPayload {
  ttmTypeId: string;
  ttmTypeName: string;
  ttmDisplayName: string;
  ttmIsActive: boolean;
  ttmIsDeleted: boolean;
  ttmSyncDate: string | null;
  ttmCreatedOn: string;
  ttmCreatedBy: string | null;
  // acc_tender_types.ttm_modified_on is nullable — a row that has never been
  // updated since its migration seed carries no modification timestamp.
  ttmModifiedOn: string | null;
  ttmModifiedBy: string | null;
}
