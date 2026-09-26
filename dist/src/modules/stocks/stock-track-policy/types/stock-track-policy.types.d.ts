export interface ItemTrackPolicySource {
    itemId: string;
    itemCompanyId: string | null;
    itemBranchId: string | null;
    itemTrackPresetId: string | null;
    itemBatchConfig: number;
    itemIsBatchBased: boolean;
    itemIsExpiryItem: boolean;
    itemExpiryDays: number | null;
    itemIntimateBeforeDays: number | null;
    itemAllowNegStock: boolean;
}
export interface ItemGroupTrackPolicySource {
    itgId: string;
    itgTrackPresetId: string | null;
}
export interface DerivedTrackPolicy {
    trackBatch: boolean;
    trackMrp: boolean;
    trackSalePrice: boolean;
    trackExpiry: boolean;
    trackSerial: boolean;
    trackSupplier: boolean;
    valuationMethod: string;
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
