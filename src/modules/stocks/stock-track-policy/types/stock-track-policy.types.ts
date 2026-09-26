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
  /**
   * stock.stock_track_preset.spt_id. When set, the preset supplies ALL thirteen
   * policy columns and the flags below are not read; when it is null, the flags
   * are the fallback.
   */
  itemTrackPresetId: string | null;
  /** 1 = MRP-wise, 2 = batch-wise, anything else = neither. */
  itemBatchConfig: number;
  itemIsBatchBased: boolean;
  itemIsExpiryItem: boolean;
  itemExpiryDays: number | null;
  itemIntimateBeforeDays: number | null;
  itemAllowNegStock: boolean;
}
/**
 * The slice of inventory.item_group_master that decides a group's track policy.
 *
 * Short because there is nothing else to read: item_group_master has no
 * tracking flags, no company and no branch. The preset code is the ONLY input,
 * which is why a group with no preset gets no policy row at all rather than a
 * defaulted one.
 */
export interface ItemGroupTrackPolicySource {
  itgId: string;
  itgTrackPresetId: string | null;
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
 * created       — no policy existed for this scope at its company/branch
 * updated       — the derived row existed and at least one column changed
 * unchanged     — the derived row already said exactly this; nothing written
 * skipped_manual— an ADMIN-authored policy holds that slot; it is left alone
 * no_preset     — GROUP scope with no preset: nothing to derive, nothing written
 * cleared       — the preset was removed, so the derived row was retired
 */
export type StockTrackPolicySyncOutcome =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'skipped_manual'
  | 'no_preset'
  | 'cleared';
export interface StockTrackPolicySyncResult {
  /** null only for 'no_preset', where no row exists to name. */
  stp_id: string | null;
  /** The item id or the group id, matching `scope`. */
  scope_id: string;
  scope: 'ITEM' | 'GROUP';
  outcome: StockTrackPolicySyncOutcome;
  /** B/M/S/E/R/P, or 'N' when the scope is plain item-wise stock. */
  track_signature: string | null;
  /** The preset code the row was derived from, or null when derived from item flags. */
  preset_code: string | null;
}
