import type { ModuleErrorDetail, ModuleErrorResponse } from "../../../common/utils/module-service.utils";
export interface GstErrorDetail extends ModuleErrorDetail {
    code?: string;
}
export type GstErrorResponse = ModuleErrorResponse<GstErrorDetail>;
export interface GstSuccessResponse<T> {
    success: true;
    message: string;
    data: T;
}
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
    services: GstProviderServicePayload[];
    accounts: GstProviderAccountPayload[];
    endpointCount: number;
    errorMapCount: number;
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
export interface GstCompanyCredentialPayload extends GstAuditStamp {
    gccId: string;
    gccCompanyId: string;
    compName: string;
    gccBranchId: string | null;
    brName: string | null;
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
export interface GstCredentialVerifyResult {
    ok: boolean;
    message: string;
    errorCode?: string;
    tokenValidUntil?: string;
    creditBalance?: number | null;
}
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
