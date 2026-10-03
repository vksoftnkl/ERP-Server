/**
 * Response shapes of reports/ledger-statement (plan §5). Amounts are STRINGS with
 * two decimals — never a float — and sides are 'DR' / 'CR'.
 */

export type Side = 'DR' | 'CR';

/** A balance: the magnitude and the side. Zero reads as '0.00' DR. */
export interface SidedAmount {
  amount: string;
  side: Side;
}

export type RowKind = 'NORMAL' | 'CANCELLED' | 'REVERSAL';

/** §9 — the refusals only the service can make. */
export const LEDGER_STATEMENT_ERROR = {
  LEDGER_NOT_IN_COMPANY: 'LEDGER_NOT_IN_COMPANY',
  LEDGER_NOT_FOUND: 'LEDGER_NOT_FOUND',
  BRANCH_NOT_IN_COMPANY: 'BRANCH_NOT_IN_COMPANY',
  YEAR_UNKNOWN: 'YEAR_UNKNOWN',
  RANGE_OUTSIDE_YEAR: 'RANGE_OUTSIDE_YEAR',
  RANGE_REVERSED: 'RANGE_REVERSED',
  RANGE_TOO_LARGE: 'RANGE_TOO_LARGE',
  VOUCHER_NOT_FOUND: 'VOUCHER_NOT_FOUND',
  NO_MENU_RIGHT: 'NO_MENU_RIGHT',
} as const;

export interface LedgerPickItem {
  ledgerId: string;
  name: string;
  groupId: string | null;
  groupName: string | null;
  isBillByBill: boolean;
  /** led_company_id IS NULL — shared by every company. */
  isShared: boolean;
}

export interface LedgerPickPayload {
  items: LedgerPickItem[];
}

export interface LedgerFacts {
  ledgerId: string;
  name: string;
  groupName: string | null;
  /** acc_group_master.acc_group_nature */
  nature: string | null;
  isBillByBill: boolean;
  gstin: string | null;
  mobile: string | null;
  creditDays: number | null;
  /** sales.customers.cus_credit_amt_limit when the ledger is a customer, else null. */
  creditLimit: string | null;
}

export interface PeriodSummary {
  fromDate: string;
  toDate: string;
  opening: SidedAmount;
  debit: { amount: string; vouchers: number };
  credit: { amount: string; vouchers: number };
  closing: SidedAmount;
  /** Cancelled pairs with BOTH halves inside the period. */
  cancelledPairs: number;
  /** 'COMPANY_LEVEL_ONLY' — a branch view of a ledger opened only at company level (§4.2). */
  openingNote: string | null;
}

export interface LedgerHeaderPayload {
  ledger: LedgerFacts;
  period: PeriodSummary;
}

export interface VoucherLeg {
  rowNo: number;
  side: Side;
  ledgerId: string;
  ledgerName: string | null;
  amount: string;
  role: string | null;
  isThisLedger: boolean;
  remarks: string | null;
}

export interface VoucherRow {
  voucherId: string;
  accYear: string;
  branchId: string | null;
  branchName: string | null;
  date: string;
  voucherTypeId: number;
  voucherTypeName: string | null;
  voucherTypeShort: string | null;
  voucherNo: string | null;
  status: string;
  rowKind: RowKind;
  /** A CANCELLED / REVERSAL row whose other half falls outside the period. */
  pairOutsideRange: boolean;
  particulars: string | null;
  asPerDetails: boolean;
  legCount: number;
  narration: string | null;
  billRefs: string[];
  debit: string;
  credit: string;
  balance: SidedAmount;
  createdBy: string | null;
  src: { module: string | null; docType: string | null; docId: string | null };
  /** Only with withLegs=true (L4). */
  legs?: VoucherLeg[];
}

export interface VouchersPayload {
  broughtForward: SidedAmount;
  rows: VoucherRow[];
  carriedForward: SidedAmount;
  page: { page: number; pageSize: number; totalRows: number };
}

export interface VoucherLegsPayload {
  voucherId: string;
  accYear: string;
  voucherNo: string | null;
  date: string;
  status: string;
  legs: VoucherLeg[];
}

export interface DailyRow {
  date: string;
  debit: string;
  credit: string;
  vouchers: number;
  closing: SidedAmount;
}

export interface DailyPayload {
  opening: SidedAmount;
  days: DailyRow[];
  closing: SidedAmount;
}

export interface MonthlyRow {
  /** YYYY-MM */
  month: string;
  debit: string;
  credit: string;
  closing: SidedAmount;
  isFuture: boolean;
}

export interface MonthlyPayload {
  opening: SidedAmount;
  months: MonthlyRow[];
  closing: SidedAmount;
}

export interface ExportPayload extends LedgerHeaderPayload {
  broughtForward: SidedAmount;
  rows: VoucherRow[];
  carriedForward: SidedAmount;
  totalRows: number;
}
