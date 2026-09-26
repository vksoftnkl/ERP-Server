export type { FixedErrorDetail as UiTableMasterErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as UiTableMasterErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as UiTableMasterSuccessResponse } from 'src/common/types/module-api.types';

export interface UiTableColumnPayload {
  uiTblClmId: string;
  uiTblClmNo: string;
  uiTblClmName: string | null;
  uiTblClmTableId: string | null;
  uiTblClmColumnWidth: number | null;
  uiTblClmColumnVisibility: boolean | null;
  uiTblClmColumnFocus: boolean | null;
  uiTblClmColumnPosition: number;
  uiTblClmColumnNecessity: boolean;
  uiTblClmNextColumn: number | null;
  uiTblClmPreviousColumn: number | null;
  uiTblClmPx: string | null;
  uiTblClmIsActive: boolean;
  uiTblClmIsDeleted: boolean;
  uiTblClmSyncDate: string | null;
  uiTblClmCreatedOn: string;
  uiTblClmCreatedBy: string | null;
  uiTblClmModifiedOn: string;
  uiTblClmModifiedBy: string | null;
}

export interface UiTableMasterPayload {
  uiTblId: string;
  uiTblName: string | null;
  uiTblEditable: boolean;
  uiTblIsActive: boolean;
  uiTblIsDeleted: boolean;
  uiTblDeviceType: string | null;
  uiTblSyncDate: string | null;
  uiTblSyncOn: string | null;
  uiTblCreatedOn: string;
  uiTblCreatedBy: string | null;
  uiTblModifiedOn: string;
  uiTblModifiedBy: string | null;
  columns: UiTableColumnPayload[];
}

export type UiTableMasterListItem = UiTableMasterPayload | Record<string, unknown>;
