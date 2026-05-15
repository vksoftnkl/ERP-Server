export type { FixedErrorDetail as UiTableColumnErrorDetail } from '../../utils/fixed-api.types';
export type { FixedErrorResponse as UiTableColumnErrorResponse } from '../../utils/fixed-api.types';
export type { FixedSuccessResponse as UiTableColumnSuccessResponse } from '../../utils/fixed-api.types';
export type { FixedListMeta as UiTableColumnListMeta } from '../../utils/fixed-list.utils';

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
