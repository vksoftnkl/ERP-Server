export interface TenderTypeMasterErrorDetail {
  field: string;
  message: string;
}

export interface TenderTypeMasterErrorResponse {
  success: false;
  message: string;
  errors: TenderTypeMasterErrorDetail[];
}

export interface TenderTypeMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export interface TenderTypeMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
