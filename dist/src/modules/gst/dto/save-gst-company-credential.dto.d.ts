export declare const GST_CREDENTIAL_CLEARABLE_KEYS: readonly ["clientId", "clientSecret", "appKey"];
export declare class SaveGstCompanyCredentialDto {
    gccId?: string;
    gccCompanyId: string;
    gccBranchId?: string | null;
    gccGpvId: string;
    gccService?: string | null;
    gccEnvironment: string;
    gccPriority?: number;
    gccLoginId: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    appKey?: string;
    clear?: Array<(typeof GST_CREDENTIAL_CLEARABLE_KEYS)[number]>;
    gccPublicKeyRef?: string | null;
    gccWhitelistedIps?: string[];
    gccValidFrom: string;
    gccValidUpto?: string | null;
    gccRemarks?: string | null;
    gccIsActive?: boolean;
}
