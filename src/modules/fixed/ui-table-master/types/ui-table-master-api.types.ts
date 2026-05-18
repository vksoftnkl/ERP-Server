export type { FixedErrorDetail as UiTableMasterErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as UiTableMasterErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as UiTableMasterSuccessResponse } from 'src/common/types/module-api.types';
export type { FixedListMeta as UiTableMasterListMeta } from 'src/common/types/module-list.types';

export interface UiTableMasterPayload {
  uiTblId: string;
  uiTblName: string | null;
  uiTblEditable: boolean;
  uiTblIsActive: boolean;
  uiTblIsDeleted: boolean;
  uiTblSyncDate: string | null;
  uiTblCreatedOn: string;
  uiTblCreatedBy: string | null;
  uiTblModifiedOn: string;
  uiTblModifiedBy: string | null;
}

export type UiTableMasterListItem = UiTableMasterPayload | Record<string, unknown>;
