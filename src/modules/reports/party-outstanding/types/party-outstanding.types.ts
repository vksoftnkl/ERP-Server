/**
 * Response shapes of reports/party-outstanding (plan 2026-10-09 §5). Amounts are
 * STRINGS with two decimals — never a float. A balance is `{ amount, side }`
 * where side is null only on 0.00. Dates are ISO `YYYY-MM-DD`.
 */

export type Side = 'DR' | 'CR';

/** A balance: the magnitude and the side; `side` is null only on 0.00. */
export interface Bal {
  amount: string;
  side: Side | null;
}

export type OutstandingSide = 'RECEIVABLE' | 'PAYABLE';
export type AgeBy = 'BILL_DATE' | 'DUE_DATE';
export type PartyFlag = 'CHQ_BOUNCED' | 'OVER_LIMIT' | 'OVER_180' | 'ADVANCE';
export type BillSide = 'OWED' | 'ON_ACCOUNT';

/** §8 — the refusals only the service can make. All 422 except NO_MENU_RIGHT (403). */
export const PARTY_OUTSTANDING_ERROR = {
  AS_ON_OUTSIDE_YEARS: 'AS_ON_OUTSIDE_YEARS',
  BAD_BUCKETS: 'BAD_BUCKETS',
  BAD_SORT: 'BAD_SORT',
  NOT_FOR_PAYABLE: 'NOT_FOR_PAYABLE',
  RANGE_TOO_LARGE: 'RANGE_TOO_LARGE',
  RANGE_REVERSED: 'RANGE_REVERSED',
  PARTY_NOT_IN_COMPANY: 'PARTY_NOT_IN_COMPANY',
  PARTY_REQUIRED: 'PARTY_REQUIRED',
  BRANCH_NOT_IN_COMPANY: 'BRANCH_NOT_IN_COMPANY',
  BILL_NOT_FOUND: 'BILL_NOT_FOUND',
  NO_MENU_RIGHT: 'NO_MENU_RIGHT',
} as const;

/** `dataWarning` on a bill row (§4.3). */
export const BILL_DATA_WARNING = {
  /** The bill's adjustment rows add up to MORE than its cached alloc + disc + writeoff. */
  ALLOC_BELOW_ROWS: 'ALLOC_BELOW_ROWS',
} as const;

// ── §5.1 /options ──────────────────────────────────────────────────────────

export interface OptionsPayload {
  groups: { groupId: string; name: string; depth: number; isDefault: boolean }[];
  areas: { areaId: string; name: string; collectionDays: string[] }[];
  salesmen: { salesmanId: string; name: string }[];
  branches: { branchId: string; name: string }[];
}

// ── §5.2 /parties ──────────────────────────────────────────────────────────

export interface PartyRow {
  partyId: string;
  name: string;
  area: string | null;
  phone: string | null;
  creditDays: number | null;
  creditLimit: string | null;
  /** Owed-side open bills. */
  bills: number;
  owed: string;
  onAccount: string;
  net: Bal;
  /** Same length as bucketLabels. */
  buckets: string[];
  overdue: string;
  oldestDays: number | null;
  pdcInHand: string;
  flags: PartyFlag[];
}

export interface PartyTotals {
  bills: number;
  owed: string;
  onAccount: string;
  net: Bal;
  buckets: string[];
  overdue: string;
  pdcInHand: string;
}

export interface PartyTiles {
  net: Bal;
  parties: number;
  bills: number;
  overdue: string;
  overduePctOfOwed: string;
  aboveDays: { days: number; amount: string; parties: number };
  onAccount: string;
  pdcInHand: { amount: string; cheques: number };
  dueNext: { days: number; amount: string; from: string; to: string };
}

export interface ReportHead {
  asOn: string;
  side: OutstandingSide;
  /** asOn is after today: post-dated cheques up to asOn count as settled. */
  isFuture: boolean;
  /** The fiscal year asOn falls in — the newest partition read (§4.1). */
  accYear: string;
  bucketLabels: string[];
}

export interface PartiesPayload extends ReportHead {
  tiles: PartyTiles;
  rows: PartyRow[];
  totals: PartyTotals;
  page: { page: number; pageSize: number; totalRows: number };
}

// ── §5.3 /party ────────────────────────────────────────────────────────────

export interface PartyFacts {
  partyId: string;
  name: string;
  ledgerGroup: string | null;
  area: string | null;
  phone: string | null;
  gstin: string | null;
  creditDays: number | null;
  creditLimit: string | null;
  creditBillLimit: number | null;
  /** The ledger has a customer row AND a supplier row (O3). */
  isDualRole: boolean;
}

export interface PdcItem {
  pdcId: string;
  accYear: string;
  chequeNo: string | null;
  bank: string | null;
  chequeDate: string;
  amount: string;
  status: string;
}

export interface PartyCardPayload extends ReportHead {
  party: PartyFacts;
  ageing: { labels: string[]; amounts: string[] };
  owed: string;
  onAccount: string;
  net: Bal;
  onAccountItems: {
    billId: string;
    accYear: string;
    docRefno: string | null;
    date: string;
    type: string;
    amount: string;
  }[];
  pdcInHand: PdcItem[];
  /** Dated on or before asOn, not yet cleared: ALREADY counted as settled (§4.5). Info only. */
  pdcEffectiveUncleared: PdcItem[];
  lastSettlement: {
    date: string;
    voucherId: string;
    voucherAccYear: string;
    voucherNo: string | null;
    voucherType: string | null;
    amount: string;
  } | null;
}

// ── §5.4 /bills and §5.5 /bill-wise ────────────────────────────────────────

export interface BillRow {
  billId: string;
  accYear: string;
  branchName: string | null;
  docDate: string;
  docRefno: string | null;
  billType: string;
  srcDocType: string | null;
  srcDocId: string | null;
  srcAccYear: string | null;
  voucherId: string | null;
  side: BillSide;
  dueDate: string | null;
  dueEff: string;
  billAmount: string;
  adjusted: string;
  pending: string;
  ageDays: number;
  overdueDays: number | null;
  remarks: string | null;
  tenderDerived: boolean;
  dataWarning?: string;
}

export interface BillTotals {
  bills: number;
  billAmount: string;
  adjusted: string;
  net: Bal;
}

export interface BillsPayload extends ReportHead {
  partyId: string;
  rows: BillRow[];
  totals: BillTotals;
  /** The party ledger's balance on asOn, ledger-statement definition (§5.4). */
  ledgerClosing: Bal;
}

export interface BillWiseRow extends BillRow {
  partyId: string;
  partyName: string;
  area: string | null;
}

export interface BillWisePayload extends ReportHead {
  rows: BillWiseRow[];
  totals: BillTotals;
  page: { page: number; pageSize: number; totalRows: number };
}

// ── §5.6 /bill-history ─────────────────────────────────────────────────────

export interface BillHistoryRow {
  adjustmentId: string;
  date: string;
  adjType: string;
  voucherId: string | null;
  voucherAccYear: string | null;
  voucherNo: string | null;
  voucherType: string | null;
  againstDocRefno: string | null;
  /** Signed: a reversal row is negative. */
  amount: string;
  isReversal: boolean;
  reversalReason: string | null;
  isPostDated: boolean;
  chequeNo: string | null;
  /** abj_adj_date <= asOn. */
  effective: boolean;
}

export interface BillHistoryPayload {
  asOn: string;
  bill: {
    billId: string;
    accYear: string;
    partyId: string;
    docRefno: string | null;
    docDate: string;
    billType: string;
    side: Side;
    billAmount: string;
    pending: string;
  };
  rows: BillHistoryRow[];
  /** §4.3's derived counter tender ("paid at counter"), or null. */
  tenderAtBill: string | null;
  dataWarning?: string;
}

// ── §5.7 /summary ──────────────────────────────────────────────────────────

export type SummaryGroupBy = 'AREA' | 'GROUP' | 'SALESMAN' | 'BRANCH';

export interface SummaryRow {
  key: string | null;
  name: string;
  parties: number;
  owed: string;
  onAccount: string;
  net: Bal;
  buckets: string[];
  overdue: string;
}

export interface SummaryPayload extends ReportHead {
  groupBy: SummaryGroupBy;
  rows: SummaryRow[];
  totals: Omit<SummaryRow, 'key' | 'name'>;
}

// ── §5.8 /due-calendar ─────────────────────────────────────────────────────

export interface DueCalendarPayload {
  asOn: string;
  side: OutstandingSide;
  from: string;
  to: string;
  /** Only days with something due; the client fills the empty ones. */
  days: { date: string; amount: string; bills: number; parties: number }[];
  /** Owed bills pending on asOn whose dueEff is before `from`. */
  overdueBefore: { amount: string; bills: number };
}

// ── §5.9 /export ───────────────────────────────────────────────────────────

export type ExportShape = 'PARTIES' | 'BILLS' | 'PARTY_STATEMENT';

interface ExportHead extends ReportHead {
  shape: ExportShape;
  /** The applied filters as one sentence. */
  printedAs: string;
  companyName: string | null;
  branchName: string | null;
  totalRows: number;
}

export interface PartiesExportPayload extends ExportHead {
  shape: 'PARTIES';
  rows: PartyRow[];
  totals: PartyTotals;
  tiles: PartyTiles;
}

export interface BillsExportPayload extends ExportHead {
  shape: 'BILLS';
  rows: BillWiseRow[];
  totals: BillTotals;
}

export interface StatementExportPayload extends ExportHead {
  shape: 'PARTY_STATEMENT';
  party: PartyFacts;
  rows: BillRow[];
  totals: BillTotals;
  ageing: { labels: string[]; amounts: string[] };
  owed: string;
  onAccount: string;
  net: Bal;
  pdcInHand: PdcItem[];
}

export type ExportPayload = PartiesExportPayload | BillsExportPayload | StatementExportPayload;
