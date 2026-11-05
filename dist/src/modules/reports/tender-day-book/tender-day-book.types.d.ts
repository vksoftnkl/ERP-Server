export declare const TENDER_BOOKS_ERROR: {
    readonly NO_MENU_RIGHT: "NO_MENU_RIGHT";
    readonly YEAR_UNKNOWN: "YEAR_UNKNOWN";
    readonly BRANCH_NOT_IN_COMPANY: "BRANCH_NOT_IN_COMPANY";
    readonly RANGE_REVERSED: "RANGE_REVERSED";
    readonly RANGE_OUTSIDE_YEAR: "RANGE_OUTSIDE_YEAR";
    readonly DATE_REQUIRED: "DATE_REQUIRED";
};
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
    isMirror: boolean;
    debit: string;
    credit: string;
}
export interface TenderBookGroup {
    key: string;
    tenderId: string | null;
    tenderName: string | null;
    tenderTypeId: number | null;
    tenderTypeName: string | null;
    ledgerId: string;
    ledgerName: string;
    ledgerType: 'CASH' | 'BANK';
    opening: string;
    debit: string;
    credit: string;
    closing: string;
}
export interface TenderBookLedger {
    ledgerId: string;
    ledgerName: string;
    ledgerType: 'CASH' | 'BANK';
    openingSet: string;
    opening: string;
    debit: string;
    credit: string;
    closing: string;
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
    count: number;
    amount: string;
    byVoucherType: {
        voucherTypeCode: string | null;
        count: number;
        amount: string;
    }[];
    rows: TenderBookRow[];
    rowsTruncated: boolean;
}
