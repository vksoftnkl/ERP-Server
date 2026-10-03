import type { ModuleErrorDetail, ModuleErrorResponse } from 'src/common/utils/module-service.utils';

/** A refusal's detail; `code` (GST_*) is what the client branches on. */
export interface GstErrorDetail extends ModuleErrorDetail {
  code?: string;
}
export type GstErrorResponse = ModuleErrorResponse<GstErrorDetail>;

export interface GstSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

/** Every master row's audit tail, as ISO strings. */
export interface GstAuditStamp {
  createdOn: string;
  createdBy: string;
  modifiedOn: string | null;
  modifiedBy: string | null;
}

export interface GstProviderServicePayload extends GstAuditStamp {
  gpsId: string;
  gpsGpvId: string;
  gpsService: string;
  gpsEnvironment: string;
  gpsBaseUrl: string;
  gpsFallbackUrls: string[];
  gpsAuthScheme: string;
  gpsTokenTtlMinutes: number;
  gpsRefreshMarginMinutes: number;
  gpsPayloadEncryption: string;
  gpsTimeoutMs: number | null;
  gpsMaxRetries: number | null;
  gpsRemarks: string | null;
  gpsIsActive: boolean;
  gpsIsDeleted: boolean;
  /** Live endpoints under this service. */
  endpointCount: number;
}

export interface GstProviderPayload extends GstAuditStamp {
  gpvId: string;
  gpvCode: string;
  gpvName: string;
  gpvPortalUrl: string | null;
  gpvSupportEmail: string | null;
  gpvSupportPhone: string | null;
  gpvTimeoutMs: number;
  gpvMaxRetries: number;
  gpvRateLimitPerMin: number | null;
  gpvRemarks: string | null;
  gpvIsActive: boolean;
  gpvIsDeleted: boolean;
  /** Live services, by service then environment. */
  services: GstProviderServicePayload[];
  /** Live accounts — secret-free, as /gst/provider-accounts/get. */
  accounts: GstProviderAccountPayload[];
  /** Live endpoints under the live services. */
  endpointCount: number;
  /** Live error-map rows. */
  errorMapCount: number;
  /** Live company credentials naming this provider (delete is refused while > 0). */
  credentialCount: number;
}

export interface GstProviderFieldMapPayload extends GstAuditStamp {
  gfmId: string;
  gfmGpeId: string;
  gfmDirection: string;
  gfmOurField: string;
  gfmTheirPath: string;
  gfmDataType: string;
  gfmTransform: string;
  gfmFormatMask: string | null;
  gfmIsRequired: boolean;
  gfmDefaultValue: string | null;
  gfmTargetColumn: string | null;
  gfmSortOrder: number;
  gfmIsDeleted: boolean;
}

export interface GstProviderEndpointPayload extends GstAuditStamp {
  gpeId: string;
  gpeGpsId: string;
  /** The service row's parent, so the screen can go back up without a second call. */
  gpvId: string;
  gpsService: string;
  gpsEnvironment: string;
  gpeAction: string;
  gpeHttpMethod: string;
  gpePathTemplate: string;
  gpeQueryTemplate: string | null;
  gpeContentType: string;
  gpeHeaders: Record<string, unknown> | null;
  gpeRequestWrapper: string | null;
  gpeRedactPaths: unknown[] | null;
  gpeResponseRootPath: string | null;
  gpeSuccessPath: string | null;
  gpeSuccessValue: string | null;
  gpeErrorCodePath: string | null;
  gpeErrorMessagePath: string | null;
  gpeTimeoutMs: number | null;
  gpeMaxRetries: number | null;
  gpeIsIdempotent: boolean;
  gpeRemarks: string | null;
  gpeIsActive: boolean;
  gpeIsDeleted: boolean;
  /** Live field-map rows, REQUEST then RESPONSE, by sort order — on /get only. */
  fieldMaps?: GstProviderFieldMapPayload[];
}

export interface GstProviderErrorMapPayload extends GstAuditStamp {
  gemId: string;
  gemGpvId: string;
  gemService: string | null;
  gemTheirCode: string;
  gemOurCode: string;
  gemMessage: string | null;
  gemTreatAs: string;
  gemExtractPath: string | null;
  gemCanonicalField: string | null;
  gemIsRetryable: boolean;
  gemRetryAfterSeconds: number | null;
  gemShouldReauth: boolean;
  gemRecoveryAction: string;
  gemSeverity: string;
  gemIsDeleted: boolean;
}

/** Notes 79 §3: never a secret, plain or encrypted — only whether each is set. */
export interface GstProviderAccountPayload extends GstAuditStamp {
  gpaId: string;
  gpaGpvId: string;
  gpvCode: string;
  gpaEnvironment: string;
  gpaService: string | null;
  gpaAccountRef: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasApiKey: boolean;
  keyVersion: number;
  gpaValidFrom: string | null;
  gpaValidUpto: string | null;
  gpaCreditBalance: number | null;
  gpaBalanceCheckedOn: string | null;
  gpaLastVerifiedOn: string | null;
  gpaRemarks: string | null;
  gpaIsActive: boolean;
  gpaIsDeleted: boolean;
}

/** Notes 79 §3: the secrets come back as has* flags; `gstin` is resolved, never stored. */
export interface GstCompanyCredentialPayload extends GstAuditStamp {
  gccId: string;
  gccCompanyId: string;
  compName: string;
  gccBranchId: string | null;
  brName: string | null;
  /** COALESCE(branch GSTIN, company GSTIN) — what vw_gst_credential shows. */
  gstin: string | null;
  gccGpvId: string;
  gpvCode: string;
  gpvName: string;
  gccService: string | null;
  gccEnvironment: string;
  gccPriority: number;
  isPrimary: boolean;
  gccLoginId: string;
  hasPassword: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasAppKey: boolean;
  keyVersion: number;
  gccPublicKeyRef: string | null;
  gccWhitelistedIps: string[];
  gccValidFrom: string | null;
  gccValidUpto: string | null;
  isExpired: boolean;
  gccPasswordChangedOn: string | null;
  gccLastVerifiedOn: string | null;
  gccLastErrorMessage: string | null;
  gccRemarks: string | null;
  gccIsActive: boolean;
  gccIsDeleted: boolean;
}

/** R8 — the outcome of ONE auth call; a refusal by the portal is ok:false, not an HTTP error. */
export interface GstCredentialVerifyResult {
  ok: boolean;
  message: string;
  /** Our code (gst_provider_error_map) when the provider's is mapped, else the provider's own. */
  errorCode?: string;
  tokenValidUntil?: string;
  creditBalance?: number | null;
}

/** R9 — read from gst_auth_session and the credential, with no portal call. */
export interface GstCredentialStatus {
  gccId: string;
  hasLiveToken: boolean;
  tokenExpiresOn: string | null;
  issuedOn: string | null;
  leaseFree: boolean;
  lastVerifiedOn: string | null;
  lastErrorMessage: string | null;
  creditBalance: number | null;
}

export interface GstDeleteResult {
  id: string;
  deleted: boolean;
}
