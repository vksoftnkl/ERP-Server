"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toProviderPayload = toProviderPayload;
exports.toProviderAuditRecord = toProviderAuditRecord;
exports.toServicePayload = toServicePayload;
exports.toEndpointPayload = toEndpointPayload;
exports.toFieldMapPayload = toFieldMapPayload;
exports.toErrorMapPayload = toErrorMapPayload;
exports.toAccountPayload = toAccountPayload;
exports.toCredentialPayload = toCredentialPayload;
exports.istToday = istToday;
const gst_config_support_1 = require("./gst-config.support");
function stampOf(createdOn, createdBy, modifiedOn, modifiedBy) {
    return {
        createdOn: createdOn.toISOString(),
        createdBy,
        modifiedOn: (0, gst_config_support_1.isoOrNull)(modifiedOn),
        modifiedBy,
    };
}
function jsonObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function toProviderPayload(row, extra) {
    return { ...toProviderAuditRecord(row), ...extra };
}
function toProviderAuditRecord(row) {
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
function toServicePayload(row, endpointCount) {
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
function toEndpointPayload(row, service) {
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
function toFieldMapPayload(row) {
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
function toErrorMapPayload(row) {
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
function toAccountPayload(row, gpvCode) {
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
        gpaValidFrom: (0, gst_config_support_1.fromDateOnly)(row.gpaValidFrom),
        gpaValidUpto: (0, gst_config_support_1.fromDateOnly)(row.gpaValidUpto),
        gpaCreditBalance: (0, gst_config_support_1.decimalOrNull)(row.gpaCreditBalance),
        gpaBalanceCheckedOn: (0, gst_config_support_1.isoOrNull)(row.gpaBalanceCheckedOn),
        gpaLastVerifiedOn: (0, gst_config_support_1.isoOrNull)(row.gpaLastVerifiedOn),
        gpaRemarks: row.gpaRemarks,
        gpaIsActive: row.gpaIsActive,
        gpaIsDeleted: row.gpaIsDeleted,
        ...stampOf(row.gpaCreatedOn, row.gpaCreatedBy, row.gpaModifiedOn, row.gpaModifiedBy),
    };
}
function toCredentialPayload(row, context, today) {
    const validUpto = (0, gst_config_support_1.fromDateOnly)(row.gccValidUpto);
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
        gccValidFrom: (0, gst_config_support_1.fromDateOnly)(row.gccValidFrom),
        gccValidUpto: validUpto,
        isExpired: validUpto !== null && validUpto < today,
        gccPasswordChangedOn: (0, gst_config_support_1.isoOrNull)(row.gccPasswordChangedOn),
        gccLastVerifiedOn: (0, gst_config_support_1.isoOrNull)(row.gccLastVerifiedOn),
        gccLastErrorMessage: row.gccLastErrorMessage,
        gccRemarks: row.gccRemarks,
        gccIsActive: row.gccIsActive,
        gccIsDeleted: row.gccIsDeleted,
        ...stampOf(row.gccCreatedOn, row.gccCreatedBy, row.gccModifiedOn, row.gccModifiedBy),
    };
}
function istToday(now = new Date()) {
    return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
//# sourceMappingURL=gst-config.mappers.js.map