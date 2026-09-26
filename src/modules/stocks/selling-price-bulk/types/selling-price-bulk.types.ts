import type { StockErrorDetail, StockErrorResponse } from 'src/common/utils/module-service.utils';

export type { StockErrorDetail, StockErrorResponse };
export type { PagedResult } from '../../stock-voucher/types/stock-voucher.types';

/**
 * Where a displayed price came from — the `Src` chip's first half.
 *
 * BUCKET  a stock.stock_mrp_price row keyed on this item's (MRP, sale price)
 *         pair. MASTER  the headline row in inventory.item_price_master,
 *         which is what an item with no live bucket shows.
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
 * NOT a Prisma enum: the column behind it is `varchar + CHECK`, and §13.1 has
 * not yet confirmed that the STORED column and the RETURNED column share a
 * name or a vocabulary. A TS union costs nothing to widen; a Prisma enum
 * silently rejects rows the database accepts.
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
 * BELOW_MIN is the one that matters most: `smp_min_price` is DATA, not a CHECK,
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
 * (`ck_smp_not_above_mrp`), and below-min has nothing behind it at all.
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
  /** For the Stock column, and for §5.4's no-stock list. */
  stockQty: number;
  /** The two identity dimensions. Both null on a MASTER row — see §4.2. */
  mrp: number | null;
  salePrice: number | null;
  priceSource: PriceSource;
  priceScope: PriceScope;
  /** NULL when priceSource = MASTER. */
  bucketId: string | null;
  costRate: number;
  minPrice: number;
  roundOff: number;
  /** Resolved server-side as of today, through item_tax_history. §4.3. */
  taxPerc: number;
  inclTax: boolean;
  /**
   * The item's tax carries a cess. The four-number panel is APPROXIMATE for it
   * — `tax_cess_unit` is a per-unit amount, not a percentage of price — so the
   * screen must say so rather than pretend. §4.3, §13.5.
   */
  hasCess: boolean;
  levels: SellingPriceLevelValue[];
}

/** §4.3 — what the tax resolver answers for one item, as of one date. */
export interface ItemTaxRate {
  itemId: string;
  taxId: string | null;
  taxPerc: number;
  inclTax: boolean;
  hasCess: boolean;
}

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
  /** stock_mrp_price rows written — S2 and S3 together. */
  saved: number;
  /** item_price_master rows written by the §6 fan-out. */
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

/**
 * What every gateway method says while `schema/stock/16_stock.sql` §20 is not
 * deployed here. §0.1.
 */
export const STOCK_MRP_PRICE_NOT_DEPLOYED =
  'stock.stock_mrp_price is not deployed on this database. It ships out of band ' +
  'from the schema/stock share, like stock.stock_voucher; the price grid and the ' +
  'bucket save stay unavailable until it lands.';
