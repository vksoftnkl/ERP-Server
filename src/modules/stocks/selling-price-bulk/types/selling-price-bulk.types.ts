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
 * Which figure a row's costRate is (notes 75), so the screen can label it:
 *   MRP        the inward cost of THIS MRP's stock at the branch (an MRP-tracked
 *              item's MRP bucket) — "Cost @ MRP 40";
 *   ITEM       the branch's moving average for the whole item;
 *   PRICE_ROW  the cost stored on the answering price row (no stock cost yet).
 * Null when there is no cost at all.
 */
export const COST_BASES = ['MRP', 'ITEM', 'PRICE_ROW'] as const;
export type CostBasis = (typeof COST_BASES)[number];

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
 *
 * Notes 125 §4 (2026-10-16): User Role now has a vocabulary (UserType, the till
 * approval levels' names). HO FINANCE is NOT added — it is the cash approver's
 * top level, not merchandising; deny by default until the client says it is HQ.
 * 'SUPERADMIN' matches 'SUPER ADMIN' (the comparison ignores spaces).
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
  /** item_default_barcode — display only, never sent back on save (notes 76). */
  barcode: string | null;
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
  /**
   * Cost of ONE of this row's unit. For an MRP-tracked item's MRP bucket, what
   * that MRP's stock cost to land (notes 75); otherwise the branch average.
   */
  costRate: number;
  /**
   * costRate without tax, from the same source as costRate (notes 76). Exact for
   * an item with cess, which cost ÷ (1 + tax%) is not.
   */
  costWot: number;
  /** Which figure costRate is — see COST_BASES. */
  costBasis: CostBasis | null;
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

/**
 * Change Selling Price P1 (plan 2026-11-23 §4.1) — what a line of the grid IS:
 *   HEADLINE  the unit's headline (key -1/-1): the "other MRPs" line of an MRP item, the
 *             unit's line of a plain item. Always listed, priced or not (bucketId null).
 *   MRP       a line keyed on one MRP, in force at the branch (with or without stock).
 *   SOLD_AT   a line keyed on one sale price ("sold at 1,250").
 *   NO_PRICE  stock at the branch whose key has no line of its own; its prices are the
 *             headline's (what it sells at today), bucketId the headline's or null.
 */
export const PRICE_LINE_KINDS = ['HEADLINE', 'MRP', 'SOLD_AT', 'NO_PRICE'] as const;
export type PriceLineKind = (typeof PRICE_LINE_KINDS)[number];

/** P1 §4.7 — which cost a below-cost problem names (wording variant `rule=`). */
export const BELOW_COST_RULES = ['LINE_COST', 'STOCK_COST', 'BRANCHES'] as const;
export type BelowCostRule = (typeof BELOW_COST_RULES)[number];

/**
 * P1 §7.1 / C5 — the stock cost of the OTHER branches that read an All branches line
 * (stock on hand, a stock cost, no own line of their own): lowest and highest, per one of
 * the line's unit, tax inclusive.
 */
export interface OtherBranchesStockCost {
  low: number;
  high: number;
  lowBranch: string;
  highBranch: string;
  /** How many other branches have a stock cost for the line. */
  branches: number;
}

/** P1 §7.1 — the keys one grid line carries on top of SellingPriceRow's. */
export interface SellingPriceLineFields {
  lineKind: PriceLineKind;
  /** ipm_cost_price / ipm_cost_wot of the line itself; null on NO_PRICE and an unpriced HEADLINE. */
  lineCost: number | null;
  lineCostWot: number | null;
  /** This MRP's landing cost (MRP line) else the branch average, × the unit factor; null = none. */
  stockCost: number | null;
  stockCostWot: number | null;
  stockCostBasis: 'MRP' | 'ITEM' | null;
  /** Only on a CHAIN (All branches) line when another branch reading it has a stock cost. */
  otherBranchesStockCost: OtherBranchesStockCost | null;
  /** ipm_profit_type; blank / none → "By User", as the card. */
  profitType: string;
  /** The line's company (comp_short, else comp_name); null = shared. */
  companyId: string | null;
  companyName: string | null;
  /** The line's branch (br_short, else br_name); null = All branches. */
  branchId: string | null;
  branchName: string | null;
  /** item_unit_conversion: to-base factor, unit order, default unit. */
  unitFactor: number;
  unitSlNo: number;
  isDefaultUnit: boolean;
  /** The item row's facts, repeated on each of its lines. */
  itemGroupName: string | null;
  taxName: string | null;
  trackPresetName: string | null;
  trackMrp: boolean;
  trackSalePrice: boolean;
  itemCompanyId: string | null;
  /** The item's saleable stock at the branch, in itemStockUnit (its default unit, else base). */
  itemStockQty: number;
  itemStockUnit: string | null;
}

/**
 * P1 §4.3 — a level of a line: the old four numbers plus the line's STORED markup % (the item
 * card's typed figure; null on NO_PRICE / an unpriced headline), so the screen can show a typed
 * Profit as typed, as the card does on load.
 */
export interface SellingPriceLineLevel extends SellingPriceLevelValue {
  storedMarkupPerc: number | null;
}

/** P1 §7.1 — a line of GET /stock/price-bulk: the old row keys plus the line's own. */
export type SellingPriceLineRow = Omit<SellingPriceRow, 'levels'> &
  SellingPriceLineFields & { levels: SellingPriceLineLevel[] };

/** P1 §7.1 — the page meta: limit / offset / count count ITEMS; lines counts the lines. */
export interface SellingPriceLinePageMeta {
  limit: number;
  offset: number;
  count: number;
  lines: number;
}

/** P1 §7.3 — what Back to all branches answers. */
export interface SellingPriceBackResult {
  /** item_price_master rows soft-deleted: the own line in force and its later scheduled rows. */
  removed: number;
  removedIds: string[];
  /** What prices the unit at the branch now (the resolver's answer today). */
  nowPricedBy: {
    lineKind: PriceLineKind;
    branchId: string | null;
    ipmId: string;
    /** Sales prices A–D of that line. */
    prices: [number, number, number, number];
  };
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
  /** Notes 119 — the code the verdict is refused / asked with (STOCK_PRICE_BELOW_COST …). */
  code?: string;
  /**
   * P1 §4.7 (A3 option C) — BELOW_COST only: which cost the price is under.
   * LINE_COST / STOCK_COST only when both costs are above 0 (the higher one is named);
   * BRANCHES for another branch's stock cost (branchId / branchName set). Absent = one cost known.
   */
  rule?: BelowCostRule;
  /** BELOW_COST: the cost judged against (the higher of the two, or that branch's stock cost). */
  cost?: number;
  lineCost?: number | null;
  stockCost?: number | null;
  /** BELOW_COST rule BRANCHES: the branch whose stock cost the price is under. */
  branchId?: string | null;
  branchName?: string | null;
  /** The wording's placeholders: level (short name), price, cost, lineCost, stockCost, branch, unit, mrp, item, n. */
  params?: Record<string, string | number>;
  /** Notes 120 — the plain words of `code` (+ `rule`), when the catalogue has a row. */
  user?: { title: string; line: string; todo: string };
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

/** Notes 140 A — one row a save wrote, and the period it prices. */
export interface SellingPriceSavedRow {
  lineNo: number;
  /** The item_price_master row written (for a split, the NEW row). */
  bucketId: string;
  /** True when the row starts after today: a scheduled price, not yet on the shelf. */
  scheduled: boolean;
  /** `YYYY-MM-DD`. */
  effectiveFrom: string;
  effectiveTo: string;
  /**
   * Notes 147 B — the cost the grid shows for this row once saved, read back
   * by the grid's own rule: this MRP's stock, else the item's average, else the
   * price row's (a keyed costPrice shows here only while there is no stock).
   */
  costRate: number;
  costWot: number;
  costBasis: CostBasis | null;
}

/** §5.4 — what a save answers with. */
export interface SellingPriceSaveResult {
  /** item_price_master rows written — S2 and S3 together, buckets and headlines alike. */
  saved: number;
  /** Notes 140 A — the day the saved prices start, `YYYY-MM-DD`: the body's, else today. */
  effectiveFrom: string;
  /** Notes 140 A — per row written; empty on `needsConfirm`. */
  rows: SellingPriceSavedRow[];
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
  /**
   * Change Selling Price P2 §7.3 — present only on a save that sent `fromPurchase`: the bill
   * the purchase view was opened from. A PRICES_REVIEWED step went on its trail when saved > 0.
   */
  fromPurchase?: { piId: string; accYear: string; refno: string };
}

/** Notes 140 B — the prices a scheduled row replaces: the row before it, else what the shelf showed. */
export interface SellingPriceSchedulePrevious {
  /** The ipm_id that priced the bucket the day before; null when nothing did. */
  bucketId: string | null;
  priceScope: PriceScope | null;
  levels: SellingPriceLevelValue[];
}

/** Notes 140 B — one scheduled price: a grid row, its period, and what it replaces. */
export interface SellingPriceScheduleRow extends SellingPriceRow {
  /** `YYYY-MM-DD`, after today. */
  effectiveFrom: string;
  effectiveTo: string;
  previous: SellingPriceSchedulePrevious | null;
}

/** Notes 140 B — what a cancel did. */
export interface SellingPriceScheduleCancelResult {
  /** The scheduled row, now deleted. */
  bucketId: string;
  /** The row before it, which now runs to the cancelled row's end; null when there was none. */
  restoredId: string | null;
  /** `YYYY-MM-DD` — the restored row's new end, null with no restored row. */
  restoredTo: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Change Selling Price P2 — cost after a purchase (plan 2026-11-24 + addendum 1, 2026-11-26)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `purchase.price_update` ("After a purchase", B1): what a posted purchase INVOICE does to the
 * price lines of what it bought. A bill keeps the mode it was saved under (pi_policy).
 */
export const PURCHASE_PRICE_MODES = ['NONE', 'COST_ONLY', 'UPDATE_PRICES', 'OPEN_CHANGE_SELLING'] as const;
export type PurchasePriceMode = (typeof PURCHASE_PRICE_MODES)[number];

/** `pii_price_update_result` — ck_pii_price_result's eight values (plan §4.6). */
export const PURCHASE_PRICE_RESULTS = [
  'UPDATED',
  'COST_ONLY',
  'LATER_BILL',
  'KEPT_NEWER',
  'NO_LINE',
  'TO_REVIEW',
  'NONE',
  'OFF',
] as const;
export type PurchasePriceResult = (typeof PURCHASE_PRICE_RESULTS)[number];

/**
 * What a row of the purchase view IS (plan §7.2, addendum decision 25). An OPEN list: packs will
 * join as MADE_FROM rows (kit RP4); a client shows a kind it does not know as a grey, read-only
 * row with the server's words.
 *   BOUGHT      the price line of what a bill line bought (its unit and MRP / sale price key)
 *   CHAIN       another unit of a bought item, following by the unit chain
 *   LATER_BILL  a later POSTED bill bought the same item and key: not moved, not pre-filled
 *   NO_PRICE    the bought key has no price line yet (B3)
 */
export type FromBillKind = 'BOUGHT' | 'CHAIN' | 'LATER_BILL' | 'NO_PRICE';

/** Where a proposed level comes from: typed on the bill, the line's Profit Type, or kept as it is. */
export type FromBillLevelSource = 'BILL' | 'RULE' | 'KEPT';

export interface FromBillLevel {
  level: PriceLevel;
  price: number;
  from: FromBillLevelSource;
}

/** The proposal the view pre-fills (null on LATER_BILL). Figures of ONE of the row's unit. */
export interface FromBillProposal {
  cost: number;
  costWot: number;
  levels: FromBillLevel[];
  /** The bill's MSP (bought unit, when typed and different from the stored one), else null. */
  minPrice: number | null;
  /** Q11 — a plain item's bought-unit line takes the bill's MRP, else null (unchanged). */
  maxPrice: number | null;
}

/** CHAIN — the bought unit this row follows, and which way. */
export interface FromBillChain {
  uomId: string;
  unitName: string | null;
  /** The ratio as the words say it: "BOX ÷ 12" (SMALLER) or "PCS × 24" (BIGGER). */
  factor: number;
  way: 'SMALLER' | 'BIGGER';
}

/** LATER_BILL — the latest later bill that bought the item and key (in this row's unit and scope). */
export interface FromBillLaterBill {
  piId: string;
  accYear: string;
  refno: string;
  /** `YYYY-MM-DD`. */
  docDate: string;
  branchName: string | null;
  /** That bill's landing cost of ONE of this row's unit, with GST (2 decimals). */
  cost: number;
}

/** Review S3 — a newer change of the line after the bill (the price change log). */
export interface FromBillChange {
  /** When, ISO with +05:30 (`2026-11-25T10:20:00+05:30`). */
  at: string;
  /** The login that changed it (ipcl_user_name); null when the log has none. */
  who: string | null;
  /**
   * Where (ipcl_source): CHANGE_SELLING_PRICE · ITEM_CARD · QTY_PRICE · PURCHASE · BULK_COST_CHANGE ·
   * IMPORT · BUCKET_REKEY — an open list, show an unknown one as it is.
   */
  source: string;
}

/** The `fromBill` block of one row of GET /stock/price-bulk/purchase-lines. */
export interface FromBill {
  kind: FromBillKind;
  /** The bill line numbers this row comes from (a CHAIN row: its bought line's). */
  billLines: number[];
  /** Billed qty and free qty of the bought line(s), in `unitName` (the BOUGHT unit). */
  qty: number;
  freeQty: number;
  unitName: string | null;
  /** The bill line's rate (bought unit). */
  rate: number;
  /** The bill's landing cost of ONE of THIS row's unit: without GST, and with the item's GST. */
  landedCostWot: number;
  landedCost: number;
  chainFrom: FromBillChain | null;
  laterBill: FromBillLaterBill | null;
  proposed: FromBillProposal | null;
  /** The proposal equals the line as it stands (nothing to change). */
  sameAsNow: boolean;
  /**
   * Review S3 (plan §4.5: "the view does not apply D16; it shows the change in Row details · F6") —
   * the latest logged change of THIS line (item, unit, key; branch null or the bill's) after the
   * bill's business time, not made by this bill itself (its post, its cancel, a save from this
   * view); a company-less change only against a company-less line. Null when there is none, and
   * on a NO_PRICE row (no line yet).
   */
  changedSince: FromBillChange | null;
  /** The server's words for the "From the bill" column (after the pill). */
  words: string;
}

/** A row of the purchase view: every key of a P1 GET /stock/price-bulk line, plus fromBill. */
export type PurchaseViewRow = SellingPriceLineRow & { fromBill: FromBill };

/** The bill the purchase view was opened from. */
export interface PurchaseViewBill {
  piId: string;
  accYear: string;
  refno: string;
  /** `YYYY-MM-DD`. */
  docDate: string;
  supplierInvNo: string | null;
  supplierName: string | null;
  branchId: string;
  branchName: string | null;
  /** The POSTED step's time, ISO with +05:30; its user's login name. */
  postedOn: string | null;
  postedBy: string | null;
  /** The bill's own mode (pi_policy, an old snapshot mapped). */
  afterPurchase: PurchasePriceMode;
  /** The last PRICES_REVIEWED step (a save from this view), else null. */
  reviewedOn: string | null;
  reviewedBy: string | null;
}

export interface PurchaseViewMeta {
  items: number;
  lines: number;
  bought: number;
  chain: number;
  laterBill: number;
  noPrice: number;
  /** Rows (not LATER_BILL) whose proposal differs from the line as it stands. */
  toChange: number;
  /** Rows that are not LATER_BILL: the reopen button needs at least one. */
  latestLines: number;
}

export interface PurchaseViewResult {
  bill: PurchaseViewBill;
  items: PurchaseViewRow[];
  meta: PurchaseViewMeta;
}

/**
 * `data.afterPurchase` of the purchase invoice post / save-with-post / get answers (plan §7.4):
 * what the bill's price step did and whether its prices can be (re)opened on menu 30.
 */
export interface AfterPurchaseState {
  mode: PurchasePriceMode;
  /** Lines per pii_price_update_result; every key present. */
  results: Record<PurchasePriceResult, number>;
  /** Lines waiting for a review (TO_REVIEW). */
  toReview: number;
  /** Price lines of the bill (bought + chain) not overtaken by a later purchase; 0 unless POSTED. */
  latestLines: number;
  /** POSTED, mode not NONE, the CALLER has Edit on menu 30, latestLines > 0. */
  canOpen: boolean;
  reviewedOn: string | null;
  reviewedBy: string | null;
  /**
   * Open mode, lines to review and no save from the view yet: labels printed now carry today's
   * prices (sticker S-P2's STICKER_DOC_PRICES_PENDING line).
   */
  pricesPending: boolean;
  /**
   * What the automatic write moved (pii_old_prices): price rows written, of them by the chain, of
   * them created — the rows in force; `scheduled` (review N4) = the key's scheduled (future-dated)
   * rows that took the new cost, counted apart.
   */
  moved: { rows: number; chain: number; created: number; scheduled: number };
  /**
   * (User OK 2026-11-26) the later POSTED purchase that overtakes this bill's lines — B5 live, as
   * latestLines: the newest by (doc date, doc datetime, id) among the later bills of the bill's
   * lines that are LATER_BILL now. Null when none is (and on a DRAFT / CANCELLED / NONE bill).
   * `docDate` in the answer's own date form ('2026-11-15T00:00:00.000Z', as header.piDocDate).
   */
  laterBill: { piId: string; refno: string; docDate: string } | null;
}

/** One entry of `pii_old_prices`: a price row the post wrote, for Cancel's put-back (§4.6 / §4.9). */
export interface PurchaseOldPriceEntry {
  ipmId: string;
  kind: 'BOUGHT' | 'CHAIN';
  action: 'UPDATE' | 'CREATE';
  /** The row's figures before the write (exact decimals as text); null for CREATE. */
  before: {
    cost: string;
    costWot: string;
    prices: [string, string, string, string];
    pricesWot: [string, string, string, string];
    markups: [string, string, string, string];
    min: string;
    max: string;
    profitType: string;
    roundOff: string;
  } | null;
  /** md5 of the row as written (cost-price-bulk rowTokenSql): an untouched row still matches it. */
  afterToken: string;
  /**
   * Review N4 — a SCHEDULED row of the key (it starts on this day, `YYYY-MM-DD`, after the post's
   * day) whose cost the post moved, prices kept. Absent on the row in force.
   */
  scheduledFrom?: string;
  /** For the cancel note. */
  itemName: string;
  unitName: string | null;
}
