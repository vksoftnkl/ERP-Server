/**
 * The slice of inventory.item_master that decides an item's track policy —
 * which, since notes 68, is its preset and nothing else: the item's own
 * batch / expiry / MRP / negative-stock flags no longer derive a policy.
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
   * stock.stock_track_preset.spt_id. Set: the preset supplies ALL thirteen
   * policy columns and becomes the item's row. Null: no item row — the group,
   * then the company, governs.
   */
  itemTrackPresetId: string | null;
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
 * no_preset     — no preset on the GROUP or the ITEM: nothing written; for an
 *                 item the group / company policy governs (notes 68)
 * cleared       — the preset was removed (or the item was deleted), so the
 *                 derived row was retired
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
