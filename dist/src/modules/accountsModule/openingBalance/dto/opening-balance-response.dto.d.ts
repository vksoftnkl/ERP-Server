import { BillDrCr, OpeningDrCr, OpeningSource, OpeningStaleReason } from '../types/opening-balance-enum';
export declare class OpeningBalanceErrorFieldDto {
    field: string;
    message: string;
}
export declare class OpeningBalanceErrorResponseDto {
    success: false;
    message: string;
    errors: OpeningBalanceErrorFieldDto[];
}
export declare class TrialBalanceDto {
    totalDebit: number;
    totalCredit: number;
    difference: number;
    isBalanced: boolean;
    unmappedCount: number;
    differenceLedgerId: string | null;
    differenceLedgerName: string | null;
}
export declare class OpeningBalanceRowDto {
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
export declare class UnclassifiedLedgerDto {
    ledId: string;
    ledName: string;
    groupName: string | null;
}
export declare class OpeningBalanceListPayloadDto {
    opCompanyId: string;
    opBranchId: string | null;
    opAccYear: string;
    rows: OpeningBalanceRowDto[];
    unclassified: UnclassifiedLedgerDto[];
    trialBalance: TrialBalanceDto;
}
export declare class RetainedRowDto {
    opId: string;
    ledId: string;
    ledName: string;
    billCount: number;
}
export declare class OpeningBalanceSavePayloadDto {
    opCompanyId: string;
    opBranchId: string | null;
    opAccYear: string;
    created: number;
    updated: number;
    skippedZero: number;
    deleted: number;
    retainedWithBills: RetainedRowDto[];
    flippedToManual: string[];
    trialBalance: TrialBalanceDto;
    staledAccYears: string[];
}
export declare class OpeningBillRowDto {
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
export declare class OpeningBillsPayloadDto {
    companyId: string;
    branchId: string;
    accYear: string;
    partyId: string;
    partyName: string;
    opId: string | null;
    bills: OpeningBillRowDto[];
    billTotalAmount: number;
    billTotalDrCr: OpeningDrCr | null;
    openingAmount: number;
    openingDrCr: OpeningDrCr | null;
    isTied: boolean;
}
export declare class OpeningBillsSavePayloadDto extends OpeningBillsPayloadDto {
    created: number;
    updated: number;
    deleted: number;
    frozenUnchanged: number;
    staledAccYears: string[];
}
export declare class CarryForwardPayloadDto {
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
export declare class OpeningBalanceDeletePayloadDto {
    opId: string;
    opAccYear: string;
    deleted: true;
}
export declare class OpeningBalanceListSuccessDto {
    success: true;
    message: string;
    data: OpeningBalanceListPayloadDto;
}
export declare class OpeningBalanceSaveSuccessDto {
    success: true;
    message: string;
    data: OpeningBalanceSavePayloadDto;
}
export declare class TrialBalanceSuccessDto {
    success: true;
    message: string;
    data: TrialBalanceDto;
}
export declare class OpeningBillsSuccessDto {
    success: true;
    message: string;
    data: OpeningBillsPayloadDto;
}
export declare class OpeningBillsSaveSuccessDto {
    success: true;
    message: string;
    data: OpeningBillsSavePayloadDto;
}
export declare class CarryForwardSuccessDto {
    success: true;
    message: string;
    data: CarryForwardPayloadDto;
}
export declare class OpeningBalanceDeleteSuccessDto {
    success: true;
    message: string;
    data: OpeningBalanceDeletePayloadDto;
}
