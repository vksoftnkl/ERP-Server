/** Notes 126 §4 — Day Book by tender, and the money lines with no tender. Amounts are strings, 2 dp. */

export const TENDER_BOOKS_ERROR = {
  NO_MENU_RIGHT: 'NO_MENU_RIGHT',
  YEAR_UNKNOWN: 'YEAR_UNKNOWN',
  BRANCH_NOT_IN_COMPANY: 'BRANCH_NOT_IN_COMPANY',
  RANGE_REVERSED: 'RANGE_REVERSED',
  RANGE_OUTSIDE_YEAR: 'RANGE_OUTSIDE_YEAR',
  DATE_REQUIRED: 'DATE_REQUIRED',
} as const;

/** One money line in the range, labelled with its tender (null = no tender). */
export interface TenderBookRow {
  voucherDate: string;
  voucherId: string;
  accYear: string;
  voucherNo: string | null;
  voucherTypeId: number;
  voucherTypeCode: string | null;
  branchId: string;
  sessionId: string | null;
  partyId: string | null;
  partyName: string | null;
  ledgerId: string;
  ledgerName: string;
  ledgerType: 'CASH' | 'BANK';
  tenderId: string | null;
  tenderName: string | null;
  tenderTypeId: number | null;
  tenderTypeName: string | null;
  /** A reversal mirror (a cancel's Rev): labelled by the voucher it undoes. */
  isMirror: boolean;
  debit: string;
  credit: string;
}

/** One tender (or tender type) on one cash / bank ledger. tenderId / tenderTypeId null = no tender. */
export interface TenderBookGroup {
  key: string;
  tenderId: string | null;
  tenderName: string | null;
  tenderTypeId: number | null;
  tenderTypeName: string | null;
  ledgerId: string;
  ledgerName: string;
  ledgerType: 'CASH' | 'BANK';
  /** Σ of the year's labelled lines before fromDate (no opening set: it has no tender). */
  opening: string;
  debit: string;
  credit: string;
  closing: string;
}

/** Per cash / bank ledger: the books, so Σ groups + the opening set reconciles to the balance. */
export interface TenderBookLedger {
  ledgerId: string;
  ledgerName: string;
  ledgerType: 'CASH' | 'BANK';
  /** The year's opening set (acc_opening_balance) — not a transaction, so in no tender group. */
  openingSet: string;
  opening: string;
  debit: string;
  credit: string;
  closing: string;
  /** Σ of this ledger's no-tender lines in the range. */
  noTender: string;
}

export interface TenderDayBookPayload {
  companyId: string;
  accYear: string;
  branchId: string | null;
  fromDate: string;
  toDate: string;
  groupBy: 'TENDER' | 'TYPE';
  groups: TenderBookGroup[];
  ledgers: TenderBookLedger[];
  rows: TenderBookRow[];
  rowsTruncated: boolean;
}

export interface NoTenderPayload {
  companyId: string;
  accYear: string;
  branchId: string | null;
  fromDate: string;
  toDate: string;
  /** Should be 0: every line is a transaction a user is looking for. */
  count: number;
  amount: string;
  byVoucherType: { voucherTypeCode: string | null; count: number; amount: string }[];
  rows: TenderBookRow[];
  rowsTruncated: boolean;
}
