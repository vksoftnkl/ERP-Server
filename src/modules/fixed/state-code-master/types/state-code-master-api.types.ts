export type { FixedErrorDetail as StateCodeMasterErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as StateCodeMasterErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as StateCodeMasterSuccessResponse } from 'src/common/types/module-api.types';
export type { FixedListMeta as StateCodeMasterListMeta } from 'src/common/types/module-list.types';

export interface StateCodeMasterPayload {
  stateCode: string;
  stateName: string;
  stateUt: boolean;
  tinCode: string | null;
  isActive: boolean;
  isDeleted: boolean;
  stateSyncDate: string | null;
  createdOn: string;
  createdBy: string | null;
  modifiedOn: string;
  modifiedBy: string | null;
}

export type StateCodeMasterListItem = StateCodeMasterPayload | Record<string, unknown>;
