/**
 * The slice of inventory.item_master that decides an item's track policy.
 *
 * Declared structurally rather than as `ItemMaster` so a caller can pass the
 * Prisma record straight through (it is assignable), and a test can pass a
 * literal without inventing sixty unrelated columns.
 */
export interface ItemTrackPolicySource {
  itemId: string;
  itemCompanyId: string | null;
  itemBranchId: string | null;
  /** 1 = MRP-wise, 2 = batch-wise, anything else = neither. */
  itemBatchConfig: number;
  itemIsBatchBased: boolean;
  itemIsExpiryItem: boolean;
  itemExpiryDays: number | null;
  itemIntimateBeforeDays: number | null;
  itemAllowNegStock: boolean;
}
/** The policy columns this module derives. Everything else takes its DB default. */
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
/**
 * created       — no policy existed for this item at its company/branch
 * updated       — the derived row existed and at least one column changed
 * unchanged     — the derived row already said exactly this; nothing written
 * skipped_manual— an ADMIN-authored policy holds that slot; it is left alone
 */
export type StockTrackPolicySyncOutcome = 'created' | 'updated' | 'unchanged' | 'skipped_manual';
export interface StockTrackPolicySyncResult {
  stp_id: string;
  item_id: string;
  outcome: StockTrackPolicySyncOutcome;
  /** B/M/S/E/R/P, or 'N' when the item is plain item-wise stock. */
  track_signature: string | null;
}