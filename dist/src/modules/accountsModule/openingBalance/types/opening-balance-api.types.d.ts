import type { BillDrCr, OpeningDrCr, OpeningSource, OpeningStaleReason } from './opening-balance-enum';
export type { AccountsErrorDetail as OpeningBalanceErrorDetail } from "../../../../common/types/module-api.types";
export type { AccountsErrorResponse as OpeningBalanceErrorResponse } from "../../../../common/types/module-api.types";
export type { AccountsSuccessResponse as OpeningBalanceSuccessResponse } from "../../../../common/types/module-api.types";
export { BALANCE_SHEET_NATURES, BillDrCr, FiscalYearStatus, OPENING_BILL_TYPE, OPENING_SRC_DOC_TYPE, OPENING_SRC_MODULE, OpeningDrCr, OpeningLedgerRole, OpeningSource, OpeningStaleReason, } from './opening-balance-enum';
export interface OpeningBalanceRow {
    opId: string | null;
    ledId: string;
    ledName: string;
    groupName: string | null;
    groupNature: string | null;
    ledIsBillByBill: boolean;
    opAmount: number;
    opDrCr: OpeningDrCr | null;
    opSource: OpeningSource | null;
    opIsStale: boolean;
    opStaleSince: string | null;
    opStaleReason: OpeningStaleReason | null;
    opRemarks: string | null;
    priorClosingAmount: number | null;
    priorClosingDrCr: OpeningDrCr | null;
    billCount: number;
}
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
export interface TrialBalancePayload {
    totalDebit: number;
    totalCredit: number;
    difference: number;
    isBalanced: boolean;
    unmappedCount: number;
    differenceLedgerId: string | null;
    differenceLedgerName: string | null;
}
export interface OpeningBalanceSavePayload {
    opCompanyId: string;
    opBranchId: string | null;
    opAccYear: string;
    created: number;
    updated: number;
    skippedZero: number;
    deleted: number;
    retainedWithBills: RetainedRow[];
    flippedToManual: string[];
    trialBalance: TrialBalancePayload;
    staledAccYears: string[];
}
export interface RetainedRow {
    opId: string;
    ledId: string;
    ledName: string;
    billCount: number;
}
export interface OpeningBillsPayload {
    companyId: string;
    branchId: string;
    accYear: string;
    partyId: string;
    partyName: string;
    opId: string | null;
    bills: OpeningBillRow[];
    billTotalAmount: number;
    billTotalDrCr: OpeningDrCr | null;
    openingAmount: number;
    openingDrCr: OpeningDrCr | null;
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
    isFrozen: boolean;
}
export interface OpeningBillsSavePayload extends OpeningBillsPayload {
    created: number;
    updated: number;
    deleted: number;
    frozenUnchanged: number;
    staledAccYears: string[];
}
export interface CarryForwardPayload {
    runId: string;
    companyId: string;
    branchId: string | null;
    fromAccYear: string;
    toAccYear: string;
    created: number;
    updated: number;
    skippedManual: number;
    billsCarried: number;
    totalDebit: number;
    totalCredit: number;
    difference: number;
    isBalanced: boolean;
    profitAndLossResult: number;
    retainedEarningsLedgerId: string | null;
}
export interface OpeningBalanceDeletePayload {
    opId: string;
    opAccYear: string;
    deleted: true;
}
