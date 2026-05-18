export type { FixedErrorDetail as UiTableColumnErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as UiTableColumnErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as UiTableColumnSuccessResponse } from 'src/common/types/module-api.types';
export type { FixedListMeta as UiTableColumnListMeta } from 'src/common/types/module-list.types';

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
  uiTblClmIsActive: boolean;
  uiTblClmIsDeleted: boolean;
  uiTblClmSyncDate: string | null;
  uiTblClmCreatedOn: string;
  uiTblClmCreatedBy: string | null;
  uiTblClmModifiedOn: string;
  uiTblClmModifiedBy: string | null;
}

export type UiTableColumnListItem = UiTableColumnPayload | Record<string, unknown>;
