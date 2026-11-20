export declare const WA_DOC_TYPE_VALUES: readonly ["SALES_ORDER"];
export declare class WaCompanyDto {
    companyId: string;
}
export declare class WaActivateDto extends WaCompanyDto {
    activationCode: string;
    replace?: boolean;
}
export declare class WaDisconnectDto extends WaCompanyDto {
    reason?: string | null;
}
export declare class WaTestDto extends WaCompanyDto {
    phone: string;
}
export declare class WaOnPostTickDto {
    vchrTypeId: number;
    on: boolean;
}
export declare class WaSettingsSaveDto extends WaCompanyDto {
    defaultLanguage?: unknown;
    ratePerMessage?: unknown;
    rateGstPercent?: unknown;
    fallbackClickToChat?: unknown;
    logRetentionYears?: unknown;
    onPostTypes?: WaOnPostTickDto[];
}
export declare class WaSendDto extends WaCompanyDto {
    branchId: string;
    docType: (typeof WA_DOC_TYPE_VALUES)[number];
    docId: string;
    docAccYear: string;
    phone?: string | null;
    lang?: string | null;
}
export declare class WaRetryDto extends WaCompanyDto {
    wmlId: string;
    accYear: string;
    confirmResend?: boolean;
}
