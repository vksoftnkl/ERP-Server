export declare const GST_ACCOUNT_SECRET_KEYS: readonly ["clientId", "clientSecret", "apiKey"];
export declare class SaveGstProviderAccountDto {
    gpaId?: string;
    gpaGpvId: string;
    gpaEnvironment: string;
    gpaService?: string | null;
    gpaAccountRef: string;
    clientId?: string;
    clientSecret?: string;
    apiKey?: string;
    clear?: Array<(typeof GST_ACCOUNT_SECRET_KEYS)[number]>;
    gpaValidFrom?: string | null;
    gpaValidUpto?: string | null;
    gpaRemarks?: string | null;
    gpaIsActive?: boolean;
}
