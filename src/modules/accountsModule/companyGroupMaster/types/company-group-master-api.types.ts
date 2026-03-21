export interface CompanyGroupMasterErrorDetail {
  field: string;
  message: string;
}

export interface CompanyGroupMasterErrorResponse {
  success: false;
  message: string;
  errors: CompanyGroupMasterErrorDetail[];
}

export interface CompanyGroupMasterSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface CompanyGroupMasterPayload {
  cogGroupId: string;
  cogGroupName: string;
  cogCompanyIds: string[];
  cogIsActive: boolean;
  cogIsDeleted: boolean;
  cogSyncDate: string | null;
  cogCreatedOn: string;
  cogCreatedBy: string | null;
  cogModifiedOn: string;
  cogModifiedBy: string | null;
}

export type CompanyGroupMasterListItem = CompanyGroupMasterPayload | Record<string, unknown>;

export interface CompanyGroupMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
