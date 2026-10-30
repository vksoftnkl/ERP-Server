import type {
  BillDrCr,
  OpeningDrCr,
  OpeningSource,
  OpeningStaleReason,
} from './opening-balance-enum';

export type { AccountsErrorDetail as OpeningBalanceErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as OpeningBalanceErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as OpeningBalanceSuccessResponse } from 'src/common/types/module-api.types';
export {
  BALANCE_SHEET_NATURES,
  BillDrCr,
  FiscalYearStatus,
  OPENING_BILL_TYPE,
  OPENING_SRC_DOC_TYPE,
  OPENING_SRC_MODULE,
  OpeningDrCr,
  OpeningLedgerRole,
  OpeningSource,
  OpeningStaleReason,
} from './opening-balance-enum';

/**
 * One row of the §4.1 list: a balance-sheet ledger, with its opening if it has
 * one. Most of these are null for a ledger nobody has opened yet — that is the
 * point, the screen reviews a full chart rather than the rows that exist.
 */
export interface OpeningBalanceRow {
  /** null = this ledger has no opening for the scope asked about. */
  opId: string | null;
  ledId: string;
  ledName: string;
  groupName: string | null;
  /** Always 'Assets' or 'Liabilities' here — see unclassified[] for the rest. */
  groupNature: string | null;
  /** When true the figure is owned by the bills, and the screen shows it read-only (§5.5 rule 2). */
  ledIsBillByBill: boolean;

  /** Always positive. The side is in opDrCr — never a signed figure (§12). */
  opAmount: number;
  opDrCr: OpeningDrCr | null;
  opSource: OpeningSource | null;
  opIsStale: boolean;
  opStaleSince: string | null;
  opStaleReason: OpeningStaleReason | null;
  /**
   * Why this figure is what it is, in the operator's own words. Written by
   * /create and returned here — a remark that can be saved but never read back
   * is worse than no remark at all, because the screen paints it blank and the
   * note looks lost when it is only invisible.
   */
  opRemarks: string | null;

  /**
   * Last year's closing for the same ledger, so the screen can show it beside
   * this year's opening. Null when there is no prior year on the system.
   */
  priorClosingAmount: number | null;
  priorClosingDrCr: OpeningDrCr | null;

  /** OPENING bills linked to this opening. 0 for a ledger that is not bill-wise. */
  billCount: number;
}

/**
 * A ledger under a group with no nature at all. Reported, never dropped and
 * never defaulted to Assets (§12). Empties once the chart is fixed.
 */
export interface UnclassifiedLedger {
  ledId: string;
  ledName: string;
  groupName: string | null;
}

export interface OpeningBalanceListPayload {
  opCompanyId: string;
  opBranchId: string | null;
  opAccYear: string;
  rows: OpeningBalanceRow[];
  unclassified: UnclassifiedLedger[];
  trialBalance: TrialBalancePayload;
}

/** §4.3. Also computed server-side on save, so the caller never has to trust the screen. */
export interface TrialBalancePayload {
  totalDebit: number;
  totalCredit: number;
  /** debit - credit. Signed here deliberately: it says which side is short. */
  difference: number;
  isBalanced: boolean;
  /** Ledgers under a NULL-nature group — they are not in the totals. */
  unmappedCount: number;
  /**
   * The ledger mapped to OPENING_DIFFERENCE, so the screen can offer the plug
   * without knowing its name. Null = the company has not mapped the role, and
   * the plug cannot be offered (§4.3).
   */
  differenceLedgerId: string | null;
  differenceLedgerName: string | null;
}

export interface OpeningBalanceSavePayload {
  opCompanyId: string;
  opBranchId: string | null;
  opAccYear: string;
  created: number;
  updated: number;
  /** Rows written with amount 0 — absence is the zero, so no row exists (§5.1 rule 4). */
  skippedZero: number;
  deleted: number;
  /**
   * Rows `replace: true` wanted to delete but could not, because they still
   * have OPENING bills (§5.1 rule 6). Reported, not fatal.
   */
  retainedWithBills: RetainedRow[];
  /** Rows whose source flipped CARRY_FORWARD -> MANUAL because the figure was edited (§5.5 rule 1). */
  flippedToManual: string[];
  /** The set after the write. isBalanced false is reported, not refused (DECISION 3). */
  trialBalance: TrialBalancePayload;
  /** Later years whose CARRY_FORWARD rows this write invalidated (§5.5 rule 4). */
  staledAccYears: string[];
}

export interface RetainedRow {
  opId: string;
  ledId: string;
  ledName: string;
  billCount: number;
}

/** §4.6 GET. The party's bills plus the figures that must tie (§7.2). */
export interface OpeningBillsPayload {
  companyId: string;
  branchId: string;
  accYear: string;
  partyId: string;
  partyName: string;
  opId: string | null;
  bills: OpeningBillRow[];
  /** Sum of the bills, signed DR positive, split back into amount + side. */
  billTotalAmount: number;
  billTotalDrCr: OpeningDrCr | null;
  /** What the party's acc_opening_balance row currently says. */
  openingAmount: number;
  openingDrCr: OpeningDrCr | null;
  /** True when the two agree. False can only mean a bug — §5.5 rule 2 keeps them equal. */
  isTied: boolean;
}

export interface OpeningBillRow {
  ablId: string;
  ablDocRefno: string;
  ablDocDate: string;
  ablDueDate: string | null;
  ablCreditDays: number;
  ablGraceDays: number;
  ablDrCr: BillDrCr;
  ablBillAmount: number;
  ablAllocAmount: number;
  ablDiscAmount: number;
  ablWriteoffAmount: number;
  ablPendingAmount: number;
  ablStatus: string | null;
  ablNarration: string | null;
  /**
   * True once anything has been settled against it. Such a bill accepts only
   * date / days / narration changes (§5.5 rule 3), and the screen should show
   * the amount and side read-only.
   */
  isFrozen: boolean;
}

export interface OpeningBillsSavePayload extends OpeningBillsPayload {
  created: number;
  updated: number;
  deleted: number;
  /** Frozen bills that were left exactly as they were. */
  frozenUnchanged: number;
  staledAccYears: string[];
}

/** §4.5. Everything a carry-forward run did, and the run row that recorded it. */
export interface CarryForwardPayload {
  runId: string;
  companyId: string;
  branchId: string | null;
  fromAccYear: string;
  toAccYear: string;
  created: number;
  updated: number;
  /** MANUAL / MIGRATION rows left alone. Always reported, even when zero (§7.3). */
  skippedManual: number;
  /** OPENING bills written for bill-wise parties (§5.2 step 4). */
  billsCarried: number;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
  /**
   * The previous year's net income - expenses, carried onto the
   * RETAINED_EARNINGS ledger (DECISION 2, Tally model). Zero means there was
   * nothing to carry and no mapping was needed.
   */
  profitAndLossResult: number;
  retainedEarningsLedgerId: string | null;
}

export interface OpeningBalanceDeletePayload {
  opId: string;
  opAccYear: string;
  deleted: true;
}
