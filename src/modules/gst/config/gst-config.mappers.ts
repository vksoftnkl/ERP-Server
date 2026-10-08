import type {
  GstCompanyCredential,
  GstProvider,
  GstProviderAccount,
  GstProviderEndpoint,
  GstProviderErrorMap,
  GstProviderFieldMap,
  GstProviderService,
  Prisma,
} from '@prisma/client';
import type {
  GstAuditStamp,
  GstCompanyCredentialPayload,
  GstProviderAccountPayload,
  GstProviderEndpointPayload,
  GstProviderErrorMapPayload,
  GstProviderFieldMapPayload,
  GstProviderPayload,
  GstProviderServicePayload,
} from '../types/gst-config.types';
import { decimalOrNull, fromDateOnly, isoOrNull } from './gst-config.support';

/*
 * Rows → payloads. The account and credential mappers are the read side of
 * notes 79 §3: they see the `_enc` columns only to say whether each is set.
 * Every response, audit row and log of these masters goes through them.
 */

function stampOf(
  createdOn: Date,
  createdBy: string,
  modifiedOn: Date | null,
  modifiedBy: string | null,
): GstAuditStamp {
  return {
    createdOn: createdOn.toISOString(),
    createdBy,
    modifiedOn: isoOrNull(modifiedOn),
    modifiedBy,
  };
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

type GstProviderExtra = Pick<
  GstProviderPayload,
  'services' | 'accounts' | 'endpointCount' | 'errorMapCount' | 'credentialCount'
>;

export function toProviderPayload(row: GstProvider, extra: GstProviderExtra): GstProviderPayload {
  return { ...toProviderAuditRecord(row), ...extra };
}

/** The provider header alone — what /create's audit row compares. */
export function toProviderAuditRecord(
  row: GstProvider,
): Omit<GstProviderPayload, keyof GstProviderExtra> {
  return {
    gpvId: row.gpvId,
    gpvCode: row.gpvCode,
    gpvName: row.gpvName,
    gpvPortalUrl: row.gpvPortalUrl,
    gpvSupportEmail: row.gpvSupportEmail,
    gpvSupportPhone: row.gpvSupportPhone,
    gpvTimeoutMs: row.gpvTimeoutMs,
    gpvMaxRetries: row.gpvMaxRetries,
    gpvRateLimitPerMin: row.gpvRateLimitPerMin,
    gpvRemarks: row.gpvRemarks,
    gpvIsActive: row.gpvIsActive,
    gpvIsDeleted: row.gpvIsDeleted,
    ...stampOf(row.gpvCreatedOn, row.gpvCreatedBy, row.gpvModifiedOn, row.gpvModifiedBy),
  };
}

export function toServicePayload(
  row: GstProviderService,
  endpointCount: number,
): GstProviderServicePayload {
  return {
    gpsId: row.gpsId,
    gpsGpvId: row.gpsGpvId,
    gpsService: row.gpsService,
    gpsEnvironment: row.gpsEnvironment,
    gpsBaseUrl: row.gpsBaseUrl,
    gpsFallbackUrls: row.gpsFallbackUrls,
    gpsAuthScheme: row.gpsAuthScheme,
    gpsTokenTtlMinutes: row.gpsTokenTtlMinutes,
    gpsRefreshMarginMinutes: row.gpsRefreshMarginMinutes,
    gpsPayloadEncryption: row.gpsPayloadEncryption,
    gpsTimeoutMs: row.gpsTimeoutMs,
    gpsMaxRetries: row.gpsMaxRetries,
    gpsRemarks: row.gpsRemarks,
    gpsIsActive: row.gpsIsActive,
    gpsIsDeleted: row.gpsIsDeleted,
    endpointCount,
    ...stampOf(row.gpsCreatedOn, row.gpsCreatedBy, row.gpsModifiedOn, row.gpsModifiedBy),
  };
}

export function toEndpointPayload(
  row: GstProviderEndpoint,
  service: Pick<GstProviderService, 'gpsGpvId' | 'gpsService' | 'gpsEnvironment'>,
): GstProviderEndpointPayload {
  return {
    gpeId: row.gpeId,
    gpeGpsId: row.gpeGpsId,
    gpvId: service.gpsGpvId,
    gpsService: service.gpsService,
    gpsEnvironment: service.gpsEnvironment,
    gpeAction: row.gpeAction,
    gpeHttpMethod: row.gpeHttpMethod,
    gpePathTemplate: row.gpePathTemplate,
    gpeQueryTemplate: row.gpeQueryTemplate,
    gpeContentType: row.gpeContentType,
    gpeHeaders: jsonObject(row.gpeHeaders),
    gpeRequestWrapper: row.gpeRequestWrapper,
    gpeRedactPaths: Array.isArray(row.gpeRedactPaths) ? row.gpeRedactPaths : null,
    gpeResponseRootPath: row.gpeResponseRootPath,
    gpeSuccessPath: row.gpeSuccessPath,
    gpeSuccessValue: row.gpeSuccessValue,
    gpeErrorCodePath: row.gpeErrorCodePath,
    gpeErrorMessagePath: row.gpeErrorMessagePath,
    gpeTimeoutMs: row.gpeTimeoutMs,
    gpeMaxRetries: row.gpeMaxRetries,
    gpeIsIdempotent: row.gpeIsIdempotent,
    gpeRemarks: row.gpeRemarks,
    gpeIsActive: row.gpeIsActive,
    gpeIsDeleted: row.gpeIsDeleted,
    ...stampOf(row.gpeCreatedOn, row.gpeCreatedBy, row.gpeModifiedOn, row.gpeModifiedBy),
  };
}

export function toFieldMapPayload(row: GstProviderFieldMap): GstProviderFieldMapPayload {
  return {
    gfmId: row.gfmId,
    gfmGpeId: row.gfmGpeId,
    gfmDirection: row.gfmDirection,
    gfmOurField: row.gfmOurField,
    gfmTheirPath: row.gfmTheirPath,
    gfmDataType: row.gfmDataType,
    gfmTransform: row.gfmTransform,
    gfmFormatMask: row.gfmFormatMask,
    gfmIsRequired: row.gfmIsRequired,
    gfmDefaultValue: row.gfmDefaultValue,
    gfmTargetColumn: row.gfmTargetColumn,
    gfmSortOrder: row.gfmSortOrder,
    gfmIsDeleted: row.gfmIsDeleted,
    ...stampOf(row.gfmCreatedOn, row.gfmCreatedBy, row.gfmModifiedOn, row.gfmModifiedBy),
  };
}

export function toErrorMapPayload(row: GstProviderErrorMap): GstProviderErrorMapPayload {
  return {
    gemId: row.gemId,
    gemGpvId: row.gemGpvId,
    gemService: row.gemService,
    gemTheirCode: row.gemTheirCode,
    gemOurCode: row.gemOurCode,
    gemMessage: row.gemMessage,
    gemTreatAs: row.gemTreatAs,
    gemExtractPath: row.gemExtractPath,
    gemCanonicalField: row.gemCanonicalField,
    gemIsRetryable: row.gemIsRetryable,
    gemRetryAfterSeconds: row.gemRetryAfterSeconds,
    gemShouldReauth: row.gemShouldReauth,
    gemRecoveryAction: row.gemRecoveryAction,
    gemSeverity: row.gemSeverity,
    gemIsDeleted: row.gemIsDeleted,
    ...stampOf(row.gemCreatedOn, row.gemCreatedBy, row.gemModifiedOn, row.gemModifiedBy),
  };
}

export function toAccountPayload(
  row: GstProviderAccount,
  gpvCode: string,
): GstProviderAccountPayload {
  return {
    gpaId: row.gpaId,
    gpaGpvId: row.gpaGpvId,
    gpvCode,
    gpaEnvironment: row.gpaEnvironment,
    gpaService: row.gpaService,
    gpaAccountRef: row.gpaAccountRef,
    hasClientId: row.gpaClientIdEnc !== null,
    hasClientSecret: row.gpaClientSecretEnc !== null,
    hasApiKey: row.gpaApiKeyEnc !== null,
    keyVersion: row.gpaKeyVersion,
    gpaValidFrom: fromDateOnly(row.gpaValidFrom),
    gpaValidUpto: fromDateOnly(row.gpaValidUpto),
    gpaCreditBalance: decimalOrNull(row.gpaCreditBalance),
    gpaBalanceCheckedOn: isoOrNull(row.gpaBalanceCheckedOn),
    gpaLastVerifiedOn: isoOrNull(row.gpaLastVerifiedOn),
    gpaRemarks: row.gpaRemarks,
    gpaIsActive: row.gpaIsActive,
    gpaIsDeleted: row.gpaIsDeleted,
    ...stampOf(row.gpaCreatedOn, row.gpaCreatedBy, row.gpaModifiedOn, row.gpaModifiedBy),
  };
}

/** The names and GSTIN a credential payload shows beside its own columns. */
export interface GstCredentialContext {
  compName: string;
  compGstinNo: string | null;
  brName: string | null;
  brGstinNo: string | null;
  gpvCode: string;
  gpvName: string;
}

export function toCredentialPayload(
  row: GstCompanyCredential,
  context: GstCredentialContext,
  today: string,
): GstCompanyCredentialPayload {
  const validUpto = fromDateOnly(row.gccValidUpto);
  return {
    gccId: row.gccId,
    gccCompanyId: row.gccCompanyId,
    compName: context.compName,
    gccBranchId: row.gccBranchId,
    brName: context.brName,
    gstin: context.brGstinNo ?? context.compGstinNo,
    gccGpvId: row.gccGpvId,
    gpvCode: context.gpvCode,
    gpvName: context.gpvName,
    gccService: row.gccService,
    gccEnvironment: row.gccEnvironment,
    gccPriority: row.gccPriority,
    isPrimary: row.gccPriority === 1,
    gccLoginId: row.gccLoginId,
    hasPassword: Boolean(row.gccPasswordEnc),
    hasClientId: row.gccClientIdEnc !== null,
    hasClientSecret: row.gccClientSecretEnc !== null,
    hasAppKey: row.gccAppKeyEnc !== null,
    keyVersion: row.gccKeyVersion,
    gccPublicKeyRef: row.gccPublicKeyRef,
    gccWhitelistedIps: row.gccWhitelistedIps,
    gccValidFrom: fromDateOnly(row.gccValidFrom),
    gccValidUpto: validUpto,
    // vw_gst_credential: gcc_valid_upto < CURRENT_DATE (the session date, IST).
    isExpired: validUpto !== null && validUpto < today,
    gccPasswordChangedOn: isoOrNull(row.gccPasswordChangedOn),
    gccLastVerifiedOn: isoOrNull(row.gccLastVerifiedOn),
    gccLastErrorMessage: row.gccLastErrorMessage,
    gccRemarks: row.gccRemarks,
    gccIsActive: row.gccIsActive,
    gccIsDeleted: row.gccIsDeleted,
    ...stampOf(row.gccCreatedOn, row.gccCreatedBy, row.gccModifiedOn, row.gccModifiedBy),
  };
}

/** Today in IST as 'YYYY-MM-DD' — the database session's CURRENT_DATE. */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
