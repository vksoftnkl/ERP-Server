export declare const PRESET_VALUATION_METHODS: readonly ["WAVG", "FIFO", "LOT_ACTUAL"];
export declare const PRESET_ISSUE_STRATEGIES: readonly ["FIFO", "FEFO", "LIFO", "MANUAL"];
export declare const PRESET_ALLOW_NEGATIVE: readonly ["ALLOW", "WARN", "BLOCK"];
export declare const PRESET_AGEING_BASES: readonly ["INWARD_DATE", "MFG_DATE", "LAST_IN_DATE"];
export type PresetValuationMethod = (typeof PRESET_VALUATION_METHODS)[number];
export type PresetIssueStrategy = (typeof PRESET_ISSUE_STRATEGIES)[number];
export type PresetAllowNegative = (typeof PRESET_ALLOW_NEGATIVE)[number];
export type PresetAgeingBasis = (typeof PRESET_AGEING_BASES)[number];
export declare const PRESET_TRACK_FIELDS: readonly ["trackBatch", "trackMrp", "trackSalePrice", "trackExpiry", "trackSerial", "trackSupplier"];
export type PresetTrackField = (typeof PRESET_TRACK_FIELDS)[number];
export declare class SaveStockTrackPresetDto {
    sptId?: string;
    companyId: string;
    code?: string;
    name?: string;
    description?: string | null;
    trackBatch?: boolean;
    trackMrp?: boolean;
    trackSalePrice?: boolean;
    trackExpiry?: boolean;
    trackSerial?: boolean;
    trackSupplier?: boolean;
    valuationMethod?: PresetValuationMethod;
    issueStrategy?: PresetIssueStrategy;
    allowNegative?: PresetAllowNegative;
    shelfLifeDays?: number | null;
    nearExpiryDays?: number;
    blockExpiredSale?: boolean;
    ageingBasis?: PresetAgeingBasis;
    sortOrder?: number;
    remarks?: string | null;
}
export declare class DeactivateStockTrackPresetDto {
    companyId: string;
    sptId: string;
    reactivate?: boolean;
}
