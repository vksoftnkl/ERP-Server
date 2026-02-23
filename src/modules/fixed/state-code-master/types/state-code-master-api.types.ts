export interface StateCodeMasterErrorDetail {
  field: string;
  message: string;
}

export interface StateCodeMasterErrorResponse {
  success: false;
  message: string;
  errors: StateCodeMasterErrorDetail[];
}

export interface StateCodeMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export interface StateCodeMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
