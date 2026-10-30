import type { Side, SidedAmount } from '../../common/voucher-books.sql';

/**
 * Response shapes of reports/day-summary (plan 2026-10-12 §5). Amounts are
 * STRINGS with two decimals — never a float — and sides are 'DR' / 'CR'.
 */

export type { Side, SidedAmount };

export type RowKind = 'NORMAL' | 'CANCELLED' | 'REVERSAL';
export type MoneyKind = 'CASH' | 'BANK' | 'CLEARING';
export type GroupLevel = 'REPORT' | 'PRIMARY' | 'LEDGER_GROUP';
export type BusinessDayStatus = 'OPEN' | 'CLOSING' | 'CLOSED' | 'NONE' | 'MIXED';
export type CheckLevel = 'OK' | 'WARN' | 'INFO' | 'FAIL';

export const MONEY_KINDS: readonly MoneyKind[] = ['CASH', 'BANK', 'CLEARING'];
export const GROUP_LEVELS: readonly GroupLevel[] = ['REPORT', 'PRIMARY', 'LEDGER_GROUP'];
export const VOUCHER_NATURES = [
  'SALES',
  'PURCHASE',
  'RECEIPT',
  'PAYMENT',
  'JOURNAL',
  'CONTRA',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'STOCK_JOURNAL',
] as const;
export type VoucherNature = (typeof VOUCHER_NATURES)[number];

/** §8 — the check codes, in the order /summary lists them. */
export const CHECK_CODES = [
  'BALANCED',
  'AMOUNT_TIES',
  'LEGLESS',
  'DRAFTS',
  'CANCELLED_PAIRS',
  'CLEARING_PENDING',
  'BUSINESS_DAY',
  'FUTURE_DATED',
  'NUMBER_GAPS',
] as const;
export type CheckCode = (typeof CHECK_CODES)[number];

/** §6.4 — the tiles, server-defined. */
export const TILE_CODES = [
  'SALES',
  'SALE_RETURNS',
  'RECEIPTS',
  'PAYMENTS',
  'EXPENSES',
  'CASH_IN_HAND',
] as const;
export type TileCode = (typeof TILE_CODES)[number];

/** §9 — the refusals only the service can make. */
export const DAY_SUMMARY_ERROR = {
  BRANCH_NOT_IN_COMPANY: 'BRANCH_NOT_IN_COMPANY',
  YEAR_UNKNOWN: 'YEAR_UNKNOWN',
  RANGE_OUTSIDE_YEAR: 'RANGE_OUTSIDE_YEAR',
  RANGE_REVERSED: 'RANGE_REVERSED',
  TYPE_UNKNOWN: 'TYPE_UNKNOWN',
  GROUP_UNKNOWN: 'GROUP_UNKNOWN',
  CHECK_UNKNOWN: 'CHECK_UNKNOWN',
  RANGE_TOO_LARGE: 'RANGE_TOO_LARGE',
  NO_MENU_RIGHT: 'NO_MENU_RIGHT',
} as const;

// ── §5.1 ────────────────────────────────────────────────────────────────────

export interface VoucherTypeItem {
  voucherTypeId: number;
  code: string;
  short: string | null;
  name: string;
  nature: string;
  category: string;
  sortOrder: number;
}

export interface VoucherTypesPayload {
  items: VoucherTypeItem[];
}

// ── §5.2 ────────────────────────────────────────────────────────────────────

export interface ScopeEcho {
  companyId: string;
  companyName: string | null;
  branchId: string | null;
  /** 'All branches' when branchId is null. */
  branchName: string;
  accYear: string;
  fromDate: string;
  toDate: string;
  days: number;
  voucherTypeId: number | null;
  clearingAsBank: boolean;
  groupLevel: GroupLevel;
  /** When the snapshot was read, IST with offset. */
  asOf: string;
}

export interface BusinessDay {
  status: BusinessDayStatus;
  /** tbd_z_no — one branch only. */
  zNo: number | null;
  sessions: { total: number; closed: number };
}

/** A tile: the movement figures, or (CASH_IN_HAND) the cash balances. */
export interface Tile {
  code: TileCode;
  amount?: string;
  vouchers?: number;
  drafts?: number;
  cancelledPairs?: number;
  /** CASH_IN_HAND only. null under a voucherTypeId filter (a balance has no type). */
  opening?: SidedAmount | null;
  closing?: SidedAmount | null;
  net?: SidedAmount;
}

export interface TypeRow {
  voucherTypeId: number;
  code: string;
  short: string | null;
  name: string;
  nature: string;
  category: string;
  /** Counted vouchers (NORMAL + lone halves). */
  vouchers: number;
  drafts: number;
  /** Pairs left out because both halves are in the range (§4.1), by the cancelled original's type. */
  cancelledPairs: number;
  /** CANCELLED / REVERSAL vouchers counted because their other half is outside the range. */
  loneHalves: number;
  /** Σ DR legs of the counted vouchers (§4.5) — never avh_doc_amount. */
  amount: string;
  cashIn: string;
  cashOut: string;
  bankIn: string;
  bankOut: string;
}

export interface TypeTotals {
  vouchers: number;
  drafts: number;
  cancelledPairs: number;
  loneHalves: number;
  amount: string;
  cashIn: string;
  cashOut: string;
  bankIn: string;
  bankOut: string;
}

export interface MoneyLedgerRow {
  ledgerId: string;
  ledgerName: string;
  kind: MoneyKind;
  /** null under a voucherTypeId filter. */
  opening: SidedAmount | null;
  in: string;
  out: string;
  closing: SidedAmount | null;
  /** 'COMPANY_LEVEL_ONLY' — a branch view of a ledger opened at company level only. */
  openingNote: string | null;
}

export interface MoneyTotal {
  opening: SidedAmount | null;
  in: string;
  out: string;
  closing: SidedAmount | null;
}

export interface GroupRow {
  groupId: string;
  groupName: string;
  /** acc_group_nature of the report group; null for the nature-less roots. */
  nature: string | null;
  debit: string;
  credit: string;
  net: SidedAmount;
  /** The group has live child groups in the tree. */
  hasChildren: boolean;
}

export interface Check {
  code: CheckCode;
  level: CheckLevel;
  facts: Record<string, unknown>;
}

export interface SummaryPayload {
  scope: ScopeEcho;
  /** One branch-or-all and one day only; null for a range (§7). */
  businessDay: BusinessDay | null;
  tiles: Tile[];
  types: TypeRow[];
  typeTotals: TypeTotals;
  moneyLedgers: MoneyLedgerRow[];
  moneyTotals: Record<MoneyKind | 'ALL', MoneyTotal>;
  groups: GroupRow[];
  groupTotals: { debit: string; credit: string };
  checks: Check[];
}

// ── §5.3 ────────────────────────────────────────────────────────────────────

export interface DayVoucherLeg {
  rowNo: number;
  ledgerId: string;
  ledgerName: string | null;
  side: Side;
  amount: string;
  role: string | null;
}

export interface DayVoucherRow {
  voucherId: string;
  accYear: string;
  date: string;
  voucherTypeId: number;
  short: string | null;
  name: string | null;
  nature: string | null;
  voucherNo: string | null;
  branchId: string;
  branchName: string | null;
  party: string | null;
  particulars: string | null;
  asPerDetails: boolean;
  legCount: number;
  narration: string | null;
  /** Σ DR legs (§4.5). */
  amount: string;
  status: string;
  rowKind: RowKind;
  /** A CANCELLED / REVERSAL row whose other half is in the range too (left out of /summary). */
  pairInRange: boolean;
  createdBy: string | null;
  src: { module: string; docType: string; docId: string } | null;
  /** Only with withLegs=true. */
  legs?: DayVoucherLeg[];
}

export interface DraftRow {
  voucherId: string;
  accYear: string;
  date: string;
  voucherTypeId: number;
  short: string | null;
  name: string | null;
  /** avh_doc_amount — a draft has no legs (§5.3). */
  amount: string;
  createdBy: string | null;
  src: { module: string; docType: string; docId: string } | null;
}

export interface PageBlock {
  page: number;
  pageSize: number;
  totalRows: number;
}

export type VouchersPayload =
  | { draftsOnly: false; rows: DayVoucherRow[]; page: PageBlock; totals: { amount: string } }
  | { draftsOnly: true; rows: DraftRow[]; page: PageBlock; totals: { amount: string } };

// ── §5.4 ────────────────────────────────────────────────────────────────────

export interface DailyRow {
  date: string;
  vouchers: number;
  drafts: number;
  cancelledPairs: number;
  amount: string;
  cashIn: string;
  cashOut: string;
  /** null under a voucherTypeId filter. */
  cashClosing: SidedAmount | null;
  bankIn: string;
  bankOut: string;
  bankClosing: SidedAmount | null;
  businessDay: BusinessDayStatus | null;
}

export interface DailyPayload {
  cashOpening: SidedAmount | null;
  bankOpening: SidedAmount | null;
  days: DailyRow[];
}

// ── §5.5 ────────────────────────────────────────────────────────────────────

export interface GroupLedgerRow {
  ledgerId: string;
  ledgerName: string;
  groupId: string;
  groupName: string | null;
  debit: string;
  credit: string;
  net: SidedAmount;
}

export interface GroupLedgersPayload {
  groupId: string;
  groupName: string;
  groupLevel: GroupLevel;
  ledgers: GroupLedgerRow[];
  totals: { debit: string; credit: string };
}

// ── §5.6 ────────────────────────────────────────────────────────────────────

export interface CheckDetailPayload {
  code: CheckCode;
  rows: Record<string, unknown>[];
  /** More rows exist than the 500 returned. */
  truncated: boolean;
}

// ── §5.7 ────────────────────────────────────────────────────────────────────

export interface ExportPayload {
  summary: SummaryPayload;
  vouchers: DayVoucherRow[];
  totalRows: number;
}
