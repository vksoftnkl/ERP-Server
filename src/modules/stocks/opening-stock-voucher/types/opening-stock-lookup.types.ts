/**
 * What the picker gets back for ONE item on the Opening Stock line grid
 * (menu 44) — 19q Q6. One round trip fills the whole line: unit, base unit,
 * conversion factor, tax, and the part nothing else answers, HOW THE ITEM IS
 * TRACKED.
 *
 * IT DELIBERATELY CARRIES NO COST. The engine resolves `rateSource` ONLY when a
 * line arrives at cost 0 (19_stock_posting.sql §2). A picker that seeds the
 * cost cell hands the engine a non-zero rate, the CASE never runs, and
 * `svh_rate_source` silently stops meaning anything — the line is valued at a
 * figure read when the item was picked rather than when it posted. AVG_COST is
 * the case that matters: the average moves with every line of the same
 * document. So the cost cell stays EMPTY unless a human types one.
 */
export interface OpeningStockItemLookup {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  barcode: string | null;

  /**
   * The unit the line is keyed in and the unit it is STORED in. Both are
   * `iuc_id`s (`inventory.item_unit_conversion`), never `unit_id`s —
   * `svi_uom_id` and `svi_base_uom_id` both point at the conversion row.
   */
  uomId: string;
  unitName: string;
  toBaseFactor: number;
  baseUomId: string;

  taxPerc: number;
  /**
   * Cess travels with the tax because the SCREEN derives cost-without-tax: a
   * per-UNIT cess is not a percentage of value, and the engine's own derivation
   * (cost / (1 + tax/100)) cannot express it.
   */
  cessPerc: number;
  cessUnit: number;

  /**
   * Which identity columns the line must carry — the `stp_track_signature` of
   * the policy in force ON THE DOCUMENT DATE, or 'N' when no policy row matches
   * at all (track nothing, the correct default for a grocery line). Nothing
   * else on the screen decides this.
   */
  trackSignature: string;

  /**
   * Lot IDENTITY, returned only because of it: a signature carrying M or S has
   * to resolve into a bucket, and these are what it resolves by. They are a
   * SEED, not an answer — most specific price scope first, then the dearest
   * bucket — and the line's real bucket is settled by the MRP that ends up
   * typed. 0 when there is no live bucket for the unit, and 0 on every database
   * where `stock.stock_mrp_price` has not been deployed (see
   * StockMrpPriceGateway). For a signature of N they are noise.
   */
  mrp: number;
  salePrice: number;

  /**
   * A WARNING, not a refusal. The engine's rule is per HOLDING (godown, lot and
   * bucket), which is finer than this can see, so true only means "this item
   * has been opened somewhere in this branch". The real check is the preflight,
   * and only that may block a save.
   */
  alreadyOpened: boolean;
}

/**
 * The parameters of one lookup — the DOCUMENT's scope, not the session's.
 * Company and branch are each optional: absent or null means "no restriction
 * on this dimension", a value means the item must be in scope for it.
 */
export interface OpeningStockItemLookupArgs {
  companyId?: string | null;
  branchId?: string | null;
  itemId: string;
  /** An `iuc_id`, or absent for the item's default unit. */
  uomId?: string;
  /**
   * The document date, yyyy-MM-dd. The tracking policy is resolved AS AT the
   * date the stock is being opened on, not as at today: a back-dated opening
   * must be keyed under the policy that was in force then.
   */
  onDate: string;
}
