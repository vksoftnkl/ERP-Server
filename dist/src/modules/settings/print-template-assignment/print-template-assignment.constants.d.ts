export declare const PTA_OUTPUT_MODES: readonly ["PRINT", "PREVIEW", "PDF", "EMAIL", "WHATSAPP", "ESCPOS"];
export type PtaOutputMode = (typeof PTA_OUTPUT_MODES)[number];
export declare const PTA_DEFAULT_OUTPUT_MODE: PtaOutputMode;
export declare const PTA_SCOPE_BY_SPECIFICITY: {
    readonly 3: "COUNTER";
    readonly 2: "BRANCH";
    readonly 1: "COMPANY";
    readonly 0: "GLOBAL";
};
export type PtaScope = (typeof PTA_SCOPE_BY_SPECIFICITY)[keyof typeof PTA_SCOPE_BY_SPECIFICITY];
export declare const PTA_SHIPPED_TEMPLATE_KEY = "00000000-0000-0000-0000-000000000000";
export declare const PTA_PRINTER_SOURCES: readonly ["PROFILE", "NAME", "DEFAULT"];
export type PtaPrinterSource = (typeof PTA_PRINTER_SOURCES)[number];
