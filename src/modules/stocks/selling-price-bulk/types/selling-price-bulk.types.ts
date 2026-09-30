import type { StockErrorDetail, StockErrorResponse } from 'src/common/utils/module-service.utils';

export type { StockErrorDetail, StockErrorResponse };
export type { PagedResult } from '../../stock-voucher/types/stock-voucher.types';

/**
 * Where a displayed price came from — the `Src` chip's first half.
 *
 * BUCKET  an inventory.item_price_master row keyed on this item's (MRP, sale
 *         price) pair. MASTER  the headline row of the same table (both bucket
 *         columns NULL), which is what an item with no row for its bucket —
 *         or no bucket at all — shows. One table since
 *         plan-nestjs-one-price-table.md; `resolveEffectivePrice` decides.
 *
 * The API sends this and `priceScope` as two columns and never a pre-rendered
 * string: the SAVE has to reason about both (§5.5), and a chip cannot be
 * reasoned about.
 */
export const PRICE_SOURCES = ['BUCKET', 'MASTER'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

/**
 * The scope discriminator, as Q25 reports it and as the header radio sets it.
 *
 * BRANCH  a row belonging to one branch — an override.
 * CHAIN   the company-wide row every branch without an override reads.
 *
 * Not stored: it is `ipm_branch_id IS NULL` of the row that answered, the
 * resolver's second output.
 */
export const PRICE_SCOPES = ['BRANCH', 'CHAIN'] as const;
export type PriceScope = (typeof PRICE_SCOPES)[number];

/**
 * The four price levels, as ORDINALS.
 *
 * inventory.item_price_master levels by COLUMN — ipm_sales_price_a…d,
 * ipm_price_a_wot…d_wot, ipm_price_a_markup_perc…d — while
 * inventory.item_price_levels supplies only the names, and carries seven rows
 * to the columns' four. So the wire format is 1…4 and the A–D letters live in
 * exactly one place (LEVEL_COLUMN_SUFFIX, used by the §6 fan-out). Nothing the
 * user reads says "A": the screen labels the four columns from
 * item_price_levels.
 */
export const PRICE_LEVELS = [1, 2, 3, 4] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

/** Ordinal → the A–D suffix of item_price_master's column triplets. §6. */
export const LEVEL_COLUMN_SUFFIX: Readonly<Record<PriceLevel, 'a' | 'b' | 'c' | 'd'>> = {
  1: 'a',
  2: 'b',
  3: 'c',
  4: 'd',
};

/** The app setting that decides what a below-cost price does. §0.3. */
export const BELOW_COST_PRICE_SETTING_KEY = 'inventory.below_cost_price';

/**
 * Its three values, as SEEDED — `20260812161533_seed_app_setting_def_catalog`
 * writes `'["restrict","warning","allow"]'::jsonb`.
 *
 * The screen plan calls them `block` / `ask` / `allow`. Those tokens are not in
 * the catalog and never were; the three BEHAVIOURS it describes are right and
 * its names for them are not. §13.4 is open on whether the client meant a
 * fourth behaviour — if it did, the catalog row needs a migration, not a
 * translation table here.
 */
export const BELOW_COST_POLICIES = ['restrict', 'warning', 'allow'] as const;
export type BelowCostPolicy = (typeof BELOW_COST_POLICIES)[number];

/**
 * The catalog's own default, and therefore the common path — a below-cost save
 * normally asks. The confirm round trip (§5.3) is not an edge case.
 */
export const DEFAULT_BELOW_COST_POLICY: BelowCostPolicy = 'warning';

/** What the policy comes to for one request. §0.3's table. */
export const BELOW_COST_ACTIONS = ['ABORT', 'CONFIRM', 'PROCEED'] as const;
export type BelowCostAction = (typeof BELOW_COST_ACTIONS)[number];

/**
 * Q26's three verdict families. §5.2.
 *
 * BELOW_MIN is the one that matters most: `ipm_min_price` is DATA, not a CHECK,
 * so Q26 is the only thing enforcing it. A below-minimum price whose verdict is
 * ignored saves cleanly and nothing downstream ever notices.
 */
export const PRICE_VERDICTS = ['ABOVE_MRP', 'BELOW_MIN', 'BELOW_COST'] as const;
export type PriceVerdict = (typeof PRICE_VERDICTS)[number];

/**
 * The verdicts a `confirmed: true` re-post may suppress — exactly one of them.
 *
 * A single confirm flag that waved through every verdict is how an amber rule
 * quietly disables the red ones: above-MRP would abort at the database anyway
 * (`ck_ipm_not_above_mrp`), and below-min has nothing behind it at all.
 */
export const CONFIRMABLE_VERDICTS: readonly PriceVerdict[] = ['BELOW_COST'];

/**
 * Which `user_master.usr_type` values may save at CHAIN scope. §5.5, §13.3.
 *
 * OPEN ITEM. `usr_type` is a free `varchar` defaulting to `'USER'`, the repo
 * seeds no vocabulary for it, and there is no roles guard in `src/common` to
 * borrow one from — so this list is a placeholder awaiting the client's answer,
 * and it is deliberately the ONLY place the answer is written down.
 *
 * DENY BY DEFAULT, and that asymmetry is the point: a wrongly refused chain
 * save is a 403 the user can escalate, while a wrongly allowed one moves every
 * branch's shelf price and is discovered at the till.
 */
export const HQ_USER_TYPES: readonly string[] = ['HQ', 'ADMIN', 'SUPERADMIN'];

/** Case- and space-insensitive membership of HQ_USER_TYPES. */
export function isHqUserType(userType: string | null | undefined): boolean {
  if (!userType) {
    return false;
  }
  const normalized = userType.trim().replace(/\s+/g, '').toUpperCase();
  return HQ_USER_TYPES.some((allowed) => allowed.replace(/\s+/g, '').toUpperCase() === normalized);
}

/** One level's four numbers, as §3 sends them and §5 receives them. */
export interface SellingPriceLevelValue {
  level: PriceLevel;
  /** (price − cost) ÷ cost, on the TAX-INCLUSIVE pair. §7. */
  markupPerc: number;
  /** price ÷ (1 + taxPerc/100). */
  priceWot: number;
  /** The shelf price. Authoritative among the four — §5.1. */
  price: number;
  /** (priceWot − costWot) ÷ priceWot, on the TAX-EXCLUSIVE pair. §7. */
  marginPerc: number;
}

/** §3 / §4 — one grid row. The contract the Qt table is built against. */
export interface SellingPriceRow {
  lineNo: number;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  uomId: string;
  unitName: string | null;
  /** On hand at the branch for this bucket, in THIS row's unit. */
  stockQty: number;
  /**
   * The row's bucket, blanked by the item's stock track policy. Both null is
   * the headline — every row of an item that tracks neither dimension.
   */
  mrp: number | null;
  salePrice: number | null;
  /**
   * What the MRP column SHOWS: the answering row's ipm_max_price — the
   * bucket's MRP on a BUCKET row, the headline's own MRP on a MASTER row, 0
   * when nothing answers. Display only; `mrp` is what the save echoes back.
   */
  maxPrice: number;
  /**
   * BUCKET: this bucket's own row answered. MASTER: the headline answered —
   * with `mrp` / `salePrice` null it IS the headline row; with either set, this
   * stock bucket has no row of its own yet and Save creates one (S3).
   */
  priceSource: PriceSource;
  /** Null when no row prices this bucket yet — the header scope decides alone on save. */
  priceScope: PriceScope | null;
  /**
   * The item_price_master row (ipm_id) that answered — a bucket row on
   * BUCKET, the headline on MASTER — or null when none did. Informational:
   * S1 finds the row to write by key at the target scope, never by this id.
   */
  bucketId: string | null;
  costRate: number;
  minPrice: number;
  roundOff: number;
  /** Resolved server-side as of today, through item_tax_history. §4.3. */
  taxPerc: number;
  inclTax: boolean;
  /**
   * The item's tax rate carries a cess or an additional cess (any basis but
   * NONE). The four-number panel is APPROXIMATE for it — `tax_cess_per_unit`
   * is a per-unit amount, not a percentage of price, and neither cess is in
   * taxPerc — so the screen must say so rather than pretend. §4.3, §13.5.
   */
  hasCess: boolean;
  levels: SellingPriceLevelValue[];
}

/** §4.3 — what the tax resolver answers for one item, as of one date. */
export type { ItemTaxRate } from '../../../Inventory/utils/item-tax-rate.helper';

/** §5.2 — one row Q26 refused, or asked about. */
export interface SellingPriceProblem {
  lineNo: number;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  uomId: string;
  bucketId: string | null;
  level: PriceLevel | null;
  verdict: PriceVerdict;
  /** Q26's own wording, verbatim. Paraphrasing it here is how the message the
   * user reads and the message in the server log drift apart. */
  message: string;
}

/** §5.4 — one row Q27 reported as priced with nothing on hand. */
export interface SellingPriceNoStockRow {
  /** The item_price_master row written. */
  bucketId: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  uomId: string;
  unitName: string | null;
  mrp: number | null;
  salePrice: number | null;
}

/** §5.4 — what a save answers with. */
export interface SellingPriceSaveResult {
  /** item_price_master rows written — S2 and S3 together, buckets and headlines alike. */
  saved: number;
  /**
   * ALWAYS 0. The headline fan-out is gone — a headline edit is S1–S3 on the
   * same table — and the key is kept for one release so a client built
   * against the frozen DTO does not break. Remove it after that.
   */
  masterRowsSaved: number;
  /** Q27 — priced, nothing on hand. Never silent: see §5.4. */
  noStock: SellingPriceNoStockRow[];
  /** True when nothing was written and the client must re-post with `confirmed`. */
  needsConfirm: boolean;
  /**
   * The rows Q26 had something to say about. On `needsConfirm` these are the
   * below-cost rows awaiting an answer; on a written save under `allow` they
   * are still reported — an allowed below-cost price is not a silent one.
   */
  problems: SellingPriceProblem[];
  /** What `inventory.below_cost_price` resolved to for this caller. */
  belowCostPolicy: BelowCostPolicy;
}
