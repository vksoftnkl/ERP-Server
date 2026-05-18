import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type GspCompanyServiceErrorDetail = ModuleApiErrorDetail;
export type GspCompanyServiceErrorResponse = ModuleApiErrorResponse<GspCompanyServiceErrorDetail>;
export type GspCompanyServiceSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type GspCompanyServiceListMeta = ModuleListMeta;

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
