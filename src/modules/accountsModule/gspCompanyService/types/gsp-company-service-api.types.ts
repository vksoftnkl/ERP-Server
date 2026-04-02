export interface GspCompanyServiceErrorDetail {
  field: string;
  message: string;
}

export interface GspCompanyServiceErrorResponse {
  success: false;
  message: string;
  errors: GspCompanyServiceErrorDetail[];
}

export interface GspCompanyServiceSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface GspCompanyServicePayload {
  csgCompanyServiceId: string;
  csgCompanyId: string;
  companyName: string | null;
  companyDisplay: string | null;
  csgGspProviderId: string;
  providerName: string | null;
  providerDisplay: string | null;
  csgServiceType: string;
  csgEuserName: string;
  csgEuserPassword: string;
  csgAuthToken: string | null;
  csgAuthTokenValidTill: string | null;
  csgIsActive: boolean;
  csgIsDeleted: boolean;
  csgSyncDate: string | null;
  csgCreatedOn: string;
  csgCreatedBy: string | null;
  csgModifiedOn: string;
  csgModifiedBy: string | null;
}

export type GspCompanyServiceListItem = GspCompanyServicePayload | Record<string, unknown>;

export interface GspCompanyServiceListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
