/**
 * Response shapes of stock/reports/summary (plan 2026-11-13 §5.2). Quantities
 * are STRINGS with three decimals in the Qty-in unit, money and rates strings
 * with two — never a float. Dates are `YYYY-MM-DD`; `asOf` / `expiresAt` are
 * IST instants with +05:30.
 */

/** "Reports › Stock Reports › Stock Summary" (migration 20261115100000_stock_summary_report). */
export const STOCK_SUMMARY_MENU_ID = 302;

/** assertMenuRight builds `<prefix>_RIGHT_VIEW / _PRINT / _EXPORT` from this. */
export const STOCK_SUMMARY_CODE_PREFIX = 'STOCK_SUMMARY';

/** §4.1(c) — every refusal the module makes. 422 except the rights (403) and RUN_EXPIRED (410). */
export const STOCK_SUMMARY_ERROR = {
  RIGHT_VIEW: 'STOCK_SUMMARY_RIGHT_VIEW',
  RIGHT_EXPORT: 'STOCK_SUMMARY_RIGHT_EXPORT',
  RIGHT_PRINT: 'STOCK_SUMMARY_RIGHT_PRINT',
  RANGE_REVERSED: 'STOCK_SUMMARY_RANGE_REVERSED',
  BRANCH_NOT_IN_COMPANY: 'STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY',
  GODOWN_NOT_IN_BRANCH: 'STOCK_SUMMARY_GODOWN_NOT_IN_BRANCH',
  GROUP_NOT_FOUND: 'STOCK_SUMMARY_GROUP_NOT_FOUND',
  BRAND_NOT_FOUND: 'STOCK_SUMMARY_BRAND_NOT_FOUND',
  ITEM_NOT_FOUND: 'STOCK_SUMMARY_ITEM_NOT_FOUND',
  RUN_EXPIRED: 'STOCK_SUMMARY_RUN_EXPIRED',
  TOO_MANY_ROWS: 'STOCK_SUMMARY_TOO_MANY_ROWS',
  TOO_MANY_ITEMS: 'STOCK_SUMMARY_TOO_MANY_ITEMS',
} as const;

export type RunKind = 'ITEMS' | 'BRANCHES';

export interface SummaryRights {
  print: boolean;
  export: boolean;
}

export interface UnitShown {
  /** The Qty-in unit's alias (else its name). */
  name: string;
  /** To-base factor, 6 dp. 1.000000 for the base unit. */
  factor: string;
  isBase: boolean;
}

// ── /options ──────────────────────────────────────────────────────────────

export interface SummaryDefaults {
  from: string;
  to: string;
  bucket: string;
  valueAt: string;
  qtyIn: string;
  hideZero: boolean;
  onlyNegative: boolean;
  noSaleDays: number;
}

export interface OptionsPayload {
  company: { companyId: string; name: string | null };
  branch: { branchId: string; name: string | null };
  godowns: { godownId: string; name: string; short: string | null }[];
  buckets: string[];
  today: string;
  fy: { name: string; begin: string; end: string } | null;
  defaults: SummaryDefaults;
  rights: SummaryRights;
}

// ── the run's head ────────────────────────────────────────────────────────

export interface SummaryHead {
  runId: string;
  kind: RunKind;
  asOf: string;
  expiresAt: string;
  companyId: string;
  companyName: string | null;
  branchId: string;
  branchName: string | null;
  from: string;
  to: string;
  /** To ≥ today (IST): reserved, available, in transit, the EXP chip and the tie are read. */
  todayOnly: boolean;
  godownId: string | null;
  godownName: string | null;
  groupId: string | null;
  groupName: string | null;
  brandId: string | null;
  brandName: string | null;
  bucket: string;
  valueAt: string;
  qtyIn: string;
  noSaleDays: number;
  rights: SummaryRights;
}

// ── Item-wise ─────────────────────────────────────────────────────────────

export type ChipKind =
  | 'NEGATIVE'
  | 'EXPIRY'
  | 'NO_SALE'
  | 'NEVER_SOLD'
  | 'OTHER_COMPANY'
  | 'NOT_TIED';

export interface Chip {
  kind: ChipKind;
  /** EXPIRY: the lot's expiry date. */
  date?: string;
  /** EXPIRY: days to expiry (negative = expired); NO_SALE: days since the last sale. */
  days?: number;
  /** EXPIRY: RED within 3 days, else AMBER. */
  tone?: 'RED' | 'AMBER';
}

export interface RowTie {
  /** Quantity AND (when checked) value. */
  equal: boolean;
  qtyEqual: boolean;
  /** null when an in-scope row is dated after `to` (the stored value then includes it). */
  valueEqual: boolean | null;
  stockNowQty: string;
  stockNowValue: string;
}

export interface SummaryRow {
  itemId: string;
  code: string | null;
  name: string;
  barcode: string | null;
  sku: string | null;
  groupId: string | null;
  groupName: string | null;
  brandId: string | null;
  brandName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unit: UnitShown;
  /** The item's default unit (`iuc_is_default_unit`), an iuc_id; null when it has none. */
  defaultUnitId: string | null;
  /** WAVG | LOT_ACTUAL at `to`. */
  valuation: string;
  otherCompany: boolean;
  opening: string;
  inward: string;
  outward: string;
  closing: string;
  /** Today-only (null when `todayOnly` is false). */
  reserved: string | null;
  available: string | null;
  inTransit: string | null;
  /** value ÷ closing in the Qty-in unit; "0.00" at closing 0. */
  rate: string;
  /** The engine's valuation at `to` (D18); negative for a negative closing (D1). */
  value: string;
  openingValue: string;
  inwardValue: string;
  outwardValue: string;
  /** value − (openingValue + inwardValue − outwardValue), exact. */
  costAdj: string;
  /** Value of the godown scope's stock in buckets other than Saleable and outside the bucket scope. */
  nonSaleableValue: string;
  lastSale: string | null;
  chips: Chip[];
  /** Today-only; null otherwise. */
  tie: RowTie | null;
}

export interface ValueTotals {
  openingValue: string;
  inwardValue: string;
  outwardValue: string;
  costAdj: string;
  closingValue: string;
}

export interface SummaryTotals extends ValueTotals {
  rows: number;
  rowsShown: number;
}

export interface SummaryTiles {
  closingValue: string;
  items: { listed: number; inStock: number; hiddenZero: number };
  negative: {
    count: number;
    value: string;
    first: { itemId: string; name: string; closing: string; unit: string } | null;
  };
  nonSaleable: {
    value: string;
    items: number;
    byBucket: { bucket: string; value: string; items: number }[];
  };
  /** Today-only; null otherwise. */
  inTransitIn: { value: string; items: number; fromBranches: string[] } | null;
  /** Today-only; null otherwise. */
  reserved: { value: string; items: number } | null;
}

export interface SummaryTie {
  checked: boolean;
  items: number;
  equal: number;
  differ: number;
  /** Every item's value was compared (no in-scope row dated after `to`). */
  valueChecked: boolean;
}

export interface TransitOut {
  /** `to` ≥ today: from stock_transit; else replayed from the ledger (§5.7). Always computed. */
  checked: boolean;
  source: 'STOCK_TRANSIT' | 'LEDGER';
  transfers: number;
  items: number;
  value: string;
  docs: { docNo: string | null; toBranch: string | null }[];
}

export interface PageInfo {
  page: number;
  limit: number;
  totalRows: number;
  hasMore: boolean;
}

export interface ViewEcho {
  sort: string;
  dir: 'asc' | 'desc';
  hideZero: boolean;
  onlyNegative: boolean;
  show: string;
  find: string;
  groupBy: string | null;
  groupKey: string | null;
}

export interface SummaryPayload {
  head: SummaryHead;
  tiles: SummaryTiles;
  totals: SummaryTotals;
  /** The value totals of the view (tile filter, Find, group drill, Only negative) — as /rows' (added 2026-11-14). */
  totalsShown: ValueTotals & { rows: number };
  tie: SummaryTie;
  transitOut: TransitOut;
  rows: SummaryRow[];
  page: PageInfo;
  view: ViewEcho;
}

export interface RowsPayload {
  runId: string;
  kind: RunKind;
  expiresAt: string;
  rows: SummaryRow[] | BranchRow[];
  page: PageInfo;
  view: ViewEcho;
  totalsShown: ValueTotals & { rows: number };
}

// ── /groups ───────────────────────────────────────────────────────────────

export type GroupBy = 'GROUP' | 'BRAND' | 'SECTION' | 'CATEGORY';

export interface GroupRow extends ValueTotals {
  /** The group / brand / section / category id; null = "(No group)". Drill with groupKey=NONE. */
  key: string | null;
  name: string;
  items: number;
  /** closingValue ÷ the total closing value × 100, 2 dp. */
  share: string;
}

export interface GroupsPayload {
  runId: string;
  groupBy: GroupBy;
  rows: GroupRow[];
  total: ValueTotals & { items: number };
}

// ── /godowns ──────────────────────────────────────────────────────────────

export interface GodownCell {
  godownId: string;
  qty: string;
  value: string;
}

export interface GodownRow {
  itemId: string;
  code: string | null;
  name: string;
  /** As the Item-wise row (added 2026-11-14: Enter → Item Ledger). */
  otherCompany: boolean;
  /** As the Item-wise row: the item's default unit iuc_id, or null. */
  defaultUnitId: string | null;
  unit: UnitShown;
  cells: GodownCell[];
  qty: string;
  value: string;
}

export interface GodownsPayload {
  runId: string;
  godowns: { godownId: string; name: string }[];
  rows: GodownRow[];
  totals: { byGodown: { godownId: string; value: string }[]; value: string };
  page: PageInfo;
  view: ViewEcho;
}

// ── /branches ─────────────────────────────────────────────────────────────

export interface BranchCell {
  branchId: string;
  qty: string;
  value: string;
}

export interface BranchRow {
  itemId: string;
  code: string | null;
  name: string;
  groupName: string | null;
  brandName: string | null;
  unit: UnitShown;
  otherCompany: boolean;
  /** As the Item-wise row: the item's default unit iuc_id, or null (added 2026-11-14). */
  defaultUnitId: string | null;
  cells: BranchCell[];
  inTransit: { qty: string; value: string };
  chain: { qty: string; value: string };
}

export interface BranchesHead extends SummaryHead {
  source: 'STOCK_BALANCE' | 'LEDGER';
}

export interface BranchesTotals {
  byBranch: { branchId: string; value: string }[];
  inTransit: { value: string; transfers: number };
  chain: { value: string };
}

export interface BranchesPayload {
  head: BranchesHead;
  branches: { branchId: string; name: string }[];
  leftOut: string[];
  rows: BranchRow[];
  totals: BranchesTotals;
  page: PageInfo;
  view: ViewEcho;
}

// ── /item ─────────────────────────────────────────────────────────────────

export interface LotRow {
  godownId: string;
  godownName: string | null;
  bucket: string;
  lotId: string;
  batchNo: string | null;
  mrp: string | null;
  expiry: string | null;
  supplier: string | null;
  onHand: string;
  /** null when `lots.source` is LEDGER (a past `to`). */
  reserved: string | null;
  available: string | null;
  costRate: string;
  value: string;
  inScope: boolean;
}

export interface MovementLine {
  type: string;
  label: string;
  kind: string;
  pairClass: string;
  docs: number;
  qtyIn: string | null;
  qtyOut: string | null;
  valueIn: string | null;
  valueOut: string | null;
  movedQty: string | null;
  pairQty: string | null;
  netsToZero: boolean;
  detail: string;
}

export interface ItemPayload {
  item: {
    itemId: string;
    code: string | null;
    name: string;
    group: string | null;
    brand: string | null;
    hsn: string | null;
    gstRate: string | null;
    trackedAs: string;
    valuation: string;
    baseUnit: string;
    unit: UnitShown;
    reorderLevel: string | null;
    belowReorder: boolean | null;
    lastPurchase: { date: string; docNo: string | null; rate: string } | null;
    lastSale: string | null;
  };
  lots: {
    source: 'STOCK_BALANCE' | 'LEDGER';
    asOf: string;
    rows: LotRow[];
    totalInScope: {
      onHand: string;
      reserved: string | null;
      available: string | null;
      value: string;
    };
  };
  movement: {
    opening: { date: string; qty: string; value: string };
    byType: MovementLine[];
    totals: { qtyIn: string; qtyOut: string; valueIn: string; valueOut: string };
    costAdj: string;
    closing: { date: string; qty: string; value: string };
    ties: { qtyEqual: boolean; valueEqual: boolean; row: boolean | null };
  };
}

// ── /export ───────────────────────────────────────────────────────────────

export type ExportTab = 'ITEMS' | 'GROUPS' | 'GODOWNS' | 'BRANCHES';

export interface ExportPayload {
  head: SummaryHead | BranchesHead;
  printedAs: string;
  tab: ExportTab;
  rows: SummaryRow[] | GroupRow[] | GodownRow[] | BranchRow[];
  totals: unknown;
  transitOut: TransitOut | null;
  tie: SummaryTie | null;
  /** GODOWNS: the columns. */
  godowns?: { godownId: string; name: string }[];
  /** BRANCHES: the columns. */
  branches?: { branchId: string; name: string }[];
  totalRows: number;
}
