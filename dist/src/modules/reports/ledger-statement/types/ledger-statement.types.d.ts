export type Side = 'DR' | 'CR';
export interface SidedAmount {
    amount: string;
    side: Side;
}
export type RowKind = 'NORMAL' | 'CANCELLED' | 'REVERSAL';
export declare const LEDGER_STATEMENT_ERROR: {
    readonly LEDGER_NOT_IN_COMPANY: "LEDGER_NOT_IN_COMPANY";
    readonly LEDGER_NOT_FOUND: "LEDGER_NOT_FOUND";
    readonly BRANCH_NOT_IN_COMPANY: "BRANCH_NOT_IN_COMPANY";
    readonly YEAR_UNKNOWN: "YEAR_UNKNOWN";
    readonly RANGE_OUTSIDE_YEAR: "RANGE_OUTSIDE_YEAR";
    readonly RANGE_REVERSED: "RANGE_REVERSED";
    readonly RANGE_TOO_LARGE: "RANGE_TOO_LARGE";
    readonly VOUCHER_NOT_FOUND: "VOUCHER_NOT_FOUND";
    readonly NO_MENU_RIGHT: "NO_MENU_RIGHT";
};
export interface LedgerPickItem {
    ledgerId: string;
    name: string;
    groupId: string | null;
    groupName: string | null;
    isBillByBill: boolean;
    isShared: boolean;
}
export interface LedgerPickPayload {
    items: LedgerPickItem[];
}
export interface LedgerFacts {
    ledgerId: string;
    name: string;
    groupName: string | null;
    nature: string | null;
    isBillByBill: boolean;
    gstin: string | null;
    mobile: string | null;
    creditDays: number | null;
    creditLimit: string | null;
}
export interface PeriodSummary {
    fromDate: string;
    toDate: string;
    opening: SidedAmount;
    debit: {
        amount: string;
        vouchers: number;
    };
    credit: {
        amount: string;
        vouchers: number;
    };
    closing: SidedAmount;
    cancelledPairs: number;
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
    src: {
        module: string | null;
        docType: string | null;
        docId: string | null;
    };
    legs?: VoucherLeg[];
}
export interface VouchersPayload {
    broughtForward: SidedAmount;
    rows: VoucherRow[];
    carriedForward: SidedAmount;
    page: {
        page: number;
        pageSize: number;
        totalRows: number;
    };
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
