export declare class SaveGstProviderDto {
    gpvId?: string;
    gpvCode: string;
    gpvName: string;
    gpvPortalUrl?: string | null;
    gpvSupportEmail?: string | null;
    gpvSupportPhone?: string | null;
    gpvTimeoutMs?: number;
    gpvMaxRetries?: number;
    gpvRateLimitPerMin?: number | null;
    gpvRemarks?: string | null;
    gpvIsActive?: boolean;
}
export declare class SaveGstProviderServiceDto {
    gpsId?: string;
    gpsGpvId: string;
    gpsService: string;
    gpsEnvironment: string;
    gpsBaseUrl: string;
    gpsFallbackUrls?: string[];
    gpsAuthScheme: string;
    gpsTokenTtlMinutes?: number;
    gpsRefreshMarginMinutes?: number;
    gpsPayloadEncryption?: string;
    gpsTimeoutMs?: number | null;
    gpsMaxRetries?: number | null;
    gpsRemarks?: string | null;
    gpsIsActive?: boolean;
}
export declare class SaveGstProviderEndpointDto {
    gpeId?: string;
    gpeGpsId: string;
    gpeAction: string;
    gpeHttpMethod?: string;
    gpePathTemplate: string;
    gpeQueryTemplate?: string | null;
    gpeContentType?: string;
    gpeHeaders?: Record<string, string> | null;
    gpeRequestWrapper?: string | null;
    gpeRedactPaths?: string[] | null;
    gpeResponseRootPath?: string | null;
    gpeSuccessPath?: string | null;
    gpeSuccessValue?: string | null;
    gpeErrorCodePath?: string | null;
    gpeErrorMessagePath?: string | null;
    gpeTimeoutMs?: number | null;
    gpeMaxRetries?: number | null;
    gpeIsIdempotent?: boolean;
    gpeRemarks?: string | null;
    gpeIsActive?: boolean;
}
export declare class SaveGstProviderFieldMapDto {
    gfmId?: string;
    gfmGpeId: string;
    gfmDirection: string;
    gfmOurField: string;
    gfmTheirPath: string;
    gfmDataType?: string;
    gfmTransform?: string;
    gfmFormatMask?: string | null;
    gfmIsRequired?: boolean;
    gfmDefaultValue?: string | null;
    gfmTargetColumn?: string | null;
    gfmSortOrder?: number;
}
export declare class SaveGstProviderErrorMapDto {
    gemId?: string;
    gemGpvId: string;
    gemService?: string | null;
    gemTheirCode: string;
    gemOurCode: string;
    gemMessage?: string | null;
    gemTreatAs?: string;
    gemExtractPath?: string | null;
    gemCanonicalField?: string | null;
    gemIsRetryable?: boolean;
    gemRetryAfterSeconds?: number | null;
    gemShouldReauth?: boolean;
    gemRecoveryAction?: string;
    gemSeverity?: string;
}
