export interface ItemTrackPolicySource {
    itemId: string;
    itemCompanyId: string | null;
    itemBranchId: string | null;
    itemBatchConfig: number;
    itemIsBatchBased: boolean;
    itemIsExpiryItem: boolean;
    itemExpiryDays: number | null;
    itemIntimateBeforeDays: number | null;
    itemAllowNegStock: boolean;
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
export type StockTrackPolicySyncOutcome = 'created' | 'updated' | 'unchanged' | 'skipped_manual';
export interface StockTrackPolicySyncResult {
    stp_id: string;
    item_id: string;
    outcome: StockTrackPolicySyncOutcome;
    track_signature: string | null;
}
