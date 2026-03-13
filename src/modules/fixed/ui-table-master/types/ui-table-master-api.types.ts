export interface UiTableMasterErrorDetail {
  field: string;
  message: string;
}

export interface UiTableMasterErrorResponse {
  success: false;
  message: string;
  errors: UiTableMasterErrorDetail[];
}

export interface UiTableMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export interface UiTableMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
