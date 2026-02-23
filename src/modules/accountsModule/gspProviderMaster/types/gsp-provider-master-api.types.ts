export interface GspProviderMasterErrorDetail {
  field: string;
  message: string;
}

export interface GspProviderMasterErrorResponse {
  success: false;
  message: string;
  errors: GspProviderMasterErrorDetail[];
}

export interface GspProviderMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface GspProviderMasterPayload {
  gspProviderId: string;
  gspProviderCode: string;
  gspProviderName: string;
  gspBaseUrl: string;
  gspRoute: string;
  gspIpAddress: string;
  gspUserName: string;
  gspUserPassword: string;
  gspIsActive: boolean;
  gspIsDeleted: boolean;
  gspCreatedOn: string;
  gspCreatedBy: string | null;
  gspModifiedOn: string;
  gspModifiedBy: string | null;
}

export type GspProviderMasterListItem = GspProviderMasterPayload | Record<string, unknown>;

export interface GspProviderMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
