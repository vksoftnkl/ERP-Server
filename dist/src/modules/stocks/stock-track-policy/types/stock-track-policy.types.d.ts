export interface ItemTrackPolicySource {
    itemId: string;
    itemCompanyId: string | null;
    itemBranchId: string | null;
    itemTrackPresetId: string | null;
}
export interface ItemGroupTrackPolicySource {
    itgId: string;
    itgTrackPresetId: string | null;
}
export interface TrackFlags {
    trackBatch: boolean;
    trackMrp: boolean;
    trackSalePrice: boolean;
    trackExpiry: boolean;
    trackSerial: boolean;
    trackSupplier: boolean;
}
export declare const STOCK_VALUATION_METHODS: readonly ["WAVG", "LOT_ACTUAL"];
export type StockValuationMethod = (typeof STOCK_VALUATION_METHODS)[number];
export declare function valuationMethodFor(flags: TrackFlags): StockValuationMethod;
export interface DerivedTrackPolicy extends TrackFlags {
    valuationMethod: StockValuationMethod;
    issueStrategy: string;
    allowNegative: string;
    shelfLifeDays: number | null;
    nearExpiryDays: number;
    blockExpiredSale: boolean;
    ageingBasis: string;
}
export type StockTrackPolicySyncOutcome = 'created' | 'updated' | 'unchanged' | 'skipped_manual' | 'no_preset' | 'cleared';
export interface StockTrackPolicySyncResult {
    stp_id: string | null;
    scope_id: string;
    scope: 'ITEM' | 'GROUP';
    outcome: StockTrackPolicySyncOutcome;
    track_signature: string | null;
    preset_code: string | null;
}
