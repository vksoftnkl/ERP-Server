import type { Side, SidedAmount } from '../../common/voucher-books.sql';
export type { Side, SidedAmount };
export type RowKind = 'NORMAL' | 'CANCELLED' | 'REVERSAL';
export type MoneyKind = 'CASH' | 'BANK' | 'CLEARING';
export type GroupLevel = 'REPORT' | 'PRIMARY' | 'LEDGER_GROUP';
export type BusinessDayStatus = 'OPEN' | 'CLOSING' | 'CLOSED' | 'NONE' | 'MIXED';
export type CheckLevel = 'OK' | 'WARN' | 'INFO' | 'FAIL';
export declare const MONEY_KINDS: readonly MoneyKind[];
export declare const GROUP_LEVELS: readonly GroupLevel[];
export declare const VOUCHER_NATURES: readonly ["SALES", "PURCHASE", "RECEIPT", "PAYMENT", "JOURNAL", "CONTRA", "DEBIT_NOTE", "CREDIT_NOTE", "STOCK_JOURNAL"];
export type VoucherNature = (typeof VOUCHER_NATURES)[number];
export declare const CHECK_CODES: readonly ["BALANCED", "AMOUNT_TIES", "LEGLESS", "DRAFTS", "CANCELLED_PAIRS", "CLEARING_PENDING", "BUSINESS_DAY", "FUTURE_DATED", "NUMBER_GAPS"];
export type CheckCode = (typeof CHECK_CODES)[number];
export declare const TILE_CODES: readonly ["SALES", "SALE_RETURNS", "RECEIPTS", "PAYMENTS", "EXPENSES", "CASH_IN_HAND"];
export type TileCode = (typeof TILE_CODES)[number];
export declare const DAY_SUMMARY_ERROR: {
    readonly BRANCH_NOT_IN_COMPANY: "BRANCH_NOT_IN_COMPANY";
    readonly YEAR_UNKNOWN: "YEAR_UNKNOWN";
    readonly RANGE_OUTSIDE_YEAR: "RANGE_OUTSIDE_YEAR";
    readonly RANGE_REVERSED: "RANGE_REVERSED";
    readonly TYPE_UNKNOWN: "TYPE_UNKNOWN";
    readonly GROUP_UNKNOWN: "GROUP_UNKNOWN";
    readonly CHECK_UNKNOWN: "CHECK_UNKNOWN";
    readonly RANGE_TOO_LARGE: "RANGE_TOO_LARGE";
    readonly NO_MENU_RIGHT: "NO_MENU_RIGHT";
};
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
export interface ScopeEcho {
    companyId: string;
    companyName: string | null;
    branchId: string | null;
    branchName: string;
    accYear: string;
    fromDate: string;
    toDate: string;
    days: number;
    voucherTypeId: number | null;
    clearingAsBank: boolean;
    groupLevel: GroupLevel;
    asOf: string;
}
export interface BusinessDay {
    status: BusinessDayStatus;
    zNo: number | null;
    sessions: {
        total: number;
        closed: number;
    };
}
export interface Tile {
    code: TileCode;
    amount?: string;
    vouchers?: number;
    drafts?: number;
    cancelledPairs?: number;
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
    opening: SidedAmount | null;
    in: string;
    out: string;
    closing: SidedAmount | null;
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
    nature: string | null;
    debit: string;
    credit: string;
    net: SidedAmount;
    hasChildren: boolean;
}
export interface Check {
    code: CheckCode;
    level: CheckLevel;
    facts: Record<string, unknown>;
}
export interface SummaryPayload {
    scope: ScopeEcho;
    businessDay: BusinessDay | null;
    tiles: Tile[];
    types: TypeRow[];
    typeTotals: TypeTotals;
    moneyLedgers: MoneyLedgerRow[];
    moneyTotals: Record<MoneyKind | 'ALL', MoneyTotal>;
    groups: GroupRow[];
    groupTotals: {
        debit: string;
        credit: string;
    };
    checks: Check[];
}
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
    amount: string;
    status: string;
    rowKind: RowKind;
    pairInRange: boolean;
    createdBy: string | null;
    src: {
        module: string;
        docType: string;
        docId: string;
    } | null;
    legs?: DayVoucherLeg[];
}
export interface DraftRow {
    voucherId: string;
    accYear: string;
    date: string;
    voucherTypeId: number;
    short: string | null;
    name: string | null;
    amount: string;
    createdBy: string | null;
    src: {
        module: string;
        docType: string;
        docId: string;
    } | null;
}
export interface PageBlock {
    page: number;
    pageSize: number;
    totalRows: number;
}
export type VouchersPayload = {
    draftsOnly: false;
    rows: DayVoucherRow[];
    page: PageBlock;
    totals: {
        amount: string;
    };
} | {
    draftsOnly: true;
    rows: DraftRow[];
    page: PageBlock;
    totals: {
        amount: string;
    };
};
export interface DailyRow {
    date: string;
    vouchers: number;
    drafts: number;
    cancelledPairs: number;
    amount: string;
    cashIn: string;
    cashOut: string;
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
    totals: {
        debit: string;
        credit: string;
    };
}
export interface CheckDetailPayload {
    code: CheckCode;
    rows: Record<string, unknown>[];
    truncated: boolean;
}
export interface ExportPayload {
    summary: SummaryPayload;
    vouchers: DayVoucherRow[];
    totalRows: number;
}
