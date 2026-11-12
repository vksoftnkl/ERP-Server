/**
 * Response shapes of stock/reports/item-ledger (plan 2026-11-11 §5). Quantities
 * are STRINGS with three decimals, money and rates strings with two — never a
 * float. Dates are `YYYY-MM-DD`; `time` is `hh:mm AM` in IST; `postedAt` /
 * `at` are ISO instants with +05:30.
 */

/** "Reports › Stock Reports › Item Ledger" (migration 20261111130000_item_ledger_report). */
export const ITEM_LEDGER_MENU_ID = 301;

/** assertMenuRight builds `<prefix>_RIGHT_VIEW` from this. */
export const ITEM_LEDGER_CODE_PREFIX = 'ITEM_LEDGER';

/** §4.1(c) — the refusals the service makes. All 422 except RIGHT_VIEW (403). */
export const ITEM_LEDGER_ERROR = {
  RIGHT_VIEW: 'ITEM_LEDGER_RIGHT_VIEW',
  BRANCH_NOT_IN_COMPANY: 'ITEM_LEDGER_BRANCH_NOT_IN_COMPANY',
  ITEM_NOT_FOUND: 'ITEM_LEDGER_ITEM_NOT_FOUND',
  RANGE_REVERSED: 'ITEM_LEDGER_RANGE_REVERSED',
  GODOWN_NOT_IN_BRANCH: 'ITEM_LEDGER_GODOWN_NOT_IN_BRANCH',
  LOT_NOT_OF_ITEM: 'ITEM_LEDGER_LOT_NOT_OF_ITEM',
  UNIT_NOT_OF_ITEM: 'ITEM_LEDGER_UNIT_NOT_OF_ITEM',
  NO_FISCAL_YEAR: 'ITEM_LEDGER_NO_FISCAL_YEAR',
  TOO_MANY_ROWS: 'ITEM_LEDGER_TOO_MANY_ROWS',
} as const;

export type RowKind = 'IN' | 'OUT' | 'INTERNAL' | 'VALUE';
export type RowState = 'LIVE' | 'CANCELLED' | 'AMENDED' | 'REVERSAL';
/** A pair class: the row itself, or the reversed pair it belongs to. */
export type PairClass = 'LIVE' | 'CANCELLED' | 'AMENDED';

/** Which screen opens a row (§5.3, §6's Enter table). */
export type DocKind =
  | 'SALE_BILL'
  | 'DELIVERY_CHALLAN'
  | 'SALE_RETURN'
  | 'DC_RETURN'
  | 'GRN'
  | 'PURCHASE_BILL'
  | 'SHORTAGE_RECEIPT'
  | 'PURCHASE_RETURN'
  | 'OPENING'
  | 'PHYSICAL'
  | 'ADJUSTMENT'
  | 'ISSUE'
  | 'GODOWN_TRANSFER'
  | 'BRANCH_OUTWARD'
  | 'BRANCH_INWARD';

export interface UnitRef {
  /** inventory.item_unit_conversion.iuc_id; null only when the item has no base row. */
  unitId: string | null;
  name: string;
  /** To-base factor, 6 dp. 1.000000 for the base unit. */
  factor: string;
  isBase: boolean;
}

export interface ReportRights {
  print: boolean;
  export: boolean;
}

// ── /options ──────────────────────────────────────────────────────────────

export interface OptionsPayload {
  item: {
    itemId: string;
    code: string | null;
    name: string;
    group: string | null;
    brand: string | null;
    hsn: string | null;
    /** The tax rate in force today, 2 dp; null when the item names none. */
    gstRate: string | null;
    trackedAs: string;
    isService: boolean;
    baseUnit: { unitId: string | null; name: string };
    units: { unitId: string; name: string; factor: string; isBase: boolean }[];
    /** Branch-level reorder level (godown NULL), in base units; null when none is set. */
    reorderLevel: string | null;
  };
  godowns: { godownId: string; name: string; short: string | null }[];
  lots: {
    lotId: string;
    batchNo: string | null;
    expiry: string | null;
    mrp: string | null;
    /** Σ stock_balance on hand of the lot at this branch, base units. */
    onHand: string;
  }[];
  types: { type: string; label: string; kind: RowKind | 'MIXED' }[];
  lastCountDate: string | null;
  fy: FyRef | null;
  rights: ReportRights;
}

export interface FyRef {
  name: string;
  begin: string;
  end: string;
}

// ── the shared head / opening / closing / totals ──────────────────────────

export interface ReportHead {
  companyId: string;
  companyName: string | null;
  branchId: string;
  branchName: string | null;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  from: string;
  to: string;
  godownId: string | null;
  godownName: string | null;
  bucket: string;
  lotId: string | null;
  batchNo: string | null;
  unit: UnitRef;
  valueAt: 'WITHOUT_TAX' | 'WITH_TAX';
  order: 'asc' | 'desc';
  showReversed: boolean;
  types: string[];
  /**
   * D17: the revaluation rows dated up to `to` (before `from` AND in the
   * period) that the opening, the rows and the closing leave out because a
   * godown or a bucket other than Saleable / All is chosen. 0 when they are in.
   */
  revaluationsLeftOut: number;
  rights: ReportRights;
}

export interface OpeningBlock {
  date: string;
  /** The day before `date`: the opening is the closing of this day. */
  closingOf: string;
  qty: string;
  value: string;
  rate: string | null;
  /** Lots with a non-zero opening quantity. */
  lots: number;
}

export interface ClosingBlock {
  date: string;
  qty: string;
  value: string;
  rate: string | null;
}

export interface LedgerTotals {
  receivedQty: string;
  issuedQty: string;
  valueIn: string;
  valueOut: string;
  /** Every period row in scope. */
  rows: number;
  /** After the row filters (types, showReversed): what the totals above add. */
  rowsShown: number;
  docs: number;
  internalMoves: number;
  reversedPairs: number;
  revaluations: number;
}

// ── GET /stock/reports/item-ledger ─────────────────────────────────────────

export interface DocRef {
  kind: DocKind | null;
  id: string;
  accYear: string | null;
  branchId: string | null;
}

export interface PartyRef {
  id: string | null;
  label: string;
  walkIn: boolean;
}

export interface ReversalInfo {
  kind: 'CANCELLED' | 'AMENDED';
  at: string | null;
  user: string | null;
  reason: string | null;
}

export interface ReversesInfo {
  kind: 'CANCELLED' | 'AMENDED';
  docNo: string | null;
  postedAt: string | null;
  /** The cancel reason / "Amended: …" (the reversal rows' narration). */
  reason: string | null;
}

export interface LedgerRow {
  rowId: string;
  seq: number;
  date: string;
  time: string | null;
  postedAt: string | null;
  type: string;
  typeLabel: string;
  kind: RowKind;
  state: RowState;
  docNo: string | null;
  /** The shadow voucher's /rN when N > 1 (a bill as amended); else null. */
  revision: number | null;
  doc: DocRef;
  party: PartyRef | null;
  detail: string;
  godownId: string | null;
  godownName: string | null;
  toGodownName: string | null;
  bucket: string | null;
  toBucket: string | null;
  lotId: string | null;
  batchNo: string | null;
  expiry: string | null;
  receivedQty: string | null;
  issuedQty: string | null;
  movedQty: string | null;
  freeQty: string | null;
  balanceQty: string;
  balanceValue: string;
  costRate: string | null;
  costValue: string;
  docRate: string | null;
  user: string | null;
  reversal: ReversalInfo | null;
  reverses: ReversesInfo | null;
}

export interface ByTypeRow {
  type: string;
  label: string;
  kind: RowKind | 'MIXED';
  /** LIVE rows, or a reversed pair (both halves) of this type. */
  pairClass: PairClass;
  docs: number;
  qtyIn: string | null;
  qtyOut: string | null;
  valueIn: string | null;
  valueOut: string | null;
  /** INTERNAL rows: Σ moved. */
  movedQty: string | null;
  /** A reversed pair: the original's quantity ("10 − 10, nets 0"). */
  pairQty: string | null;
  netsToZero: boolean;
}

export interface TileDocs {
  type: string;
  label: string;
  count: number;
}

export interface LedgerTiles {
  receivedDocs: TileDocs[];
  issuedDocs: TileDocs[];
  cancelled: { count: number; docNos: string[] };
  amended: { count: number; docNos: string[] };
}

export interface TieCheck {
  checked: boolean;
  ledgerQty: string | null;
  stockNowQty: string | null;
  equal: boolean | null;
  difference: string | null;
}

/**
 * opening + totals.received − totals.issued = closing, for the quantity and for
 * the value, decided on the exact base quantities and values BEFORE the Qty-in
 * unit and the 3 dp / 2 dp rounding (re-adding the rounded strings can be off
 * by a unit in the last place, e.g. 0.083 + 0.083 ≠ 0.167 in a unit of 12).
 * Both null when a row filter (types, showReversed) hides any row: the totals
 * are then "of the rows shown" and are not meant to meet the closing.
 */
export interface PeriodTie {
  qtyEqual: boolean | null;
  valueEqual: boolean | null;
}

export interface StockNowRow {
  godownId: string;
  godownName: string | null;
  bucket: string;
  lotId: string;
  batchNo: string | null;
  expiry: string | null;
  onHand: string;
  reserved: string;
  inTransitIn: string;
  costRate: string;
  value: string;
  inScope: boolean;
}

export interface StockNowBlock {
  asOf: string;
  rows: StockNowRow[];
  totalInScope: { onHand: string; reserved: string; inTransitIn: string; value: string };
}

export interface LedgerPayload {
  head: ReportHead;
  opening: OpeningBlock;
  closing: ClosingBlock;
  totals: LedgerTotals;
  tiles: LedgerTiles;
  tie: TieCheck;
  periodTie: PeriodTie;
  rows: LedgerRow[];
  page: { page: number; limit: number; totalRows: number; hasMore: boolean };
  byType: ByTypeRow[];
  stockNow: StockNowBlock;
}

// ── /days, /months, /export ───────────────────────────────────────────────

export interface DayRow {
  date: string;
  docs: number;
  openingQty: string;
  receivedQty: string;
  issuedQty: string;
  closingQty: string;
  valueIn: string;
  valueOut: string;
  closingValue: string;
}

export interface DaysPayload {
  head: ReportHead;
  opening: OpeningBlock;
  closing: ClosingBlock;
  days: DayRow[];
  totals: LedgerTotals;
  periodTie: PeriodTie;
}

export interface MonthRow {
  month: string;
  label: string;
  docs: number;
  openingQty: string;
  inwardQty: string;
  outwardQty: string;
  closingQty: string;
  valueIn: string;
  valueOut: string;
  closingValue: string;
  /** The month of `to`, cut short at `to`. */
  partial: boolean;
}

export interface MonthsPayload {
  head: ReportHead;
  fy: FyRef;
  opening: OpeningBlock;
  months: MonthRow[];
  yearToDate: {
    docs: number;
    inwardQty: string;
    outwardQty: string;
    closingQty: string;
    closingValue: string;
  };
}

export interface ExportPayload {
  head: ReportHead;
  /** The applied filters as one sentence, for the print heading and the CSV's first line. */
  printedAs: string;
  opening: OpeningBlock;
  closing: ClosingBlock;
  totals: LedgerTotals;
  rows: LedgerRow[];
  totalRows: number;
}
