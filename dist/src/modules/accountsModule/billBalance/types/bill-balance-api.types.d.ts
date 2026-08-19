export interface PartyCreditSummary {
    partyId: string;
    partyName: string | null;
    accYear: string | null;
    asOnDate: string;
    pendingAmount: number;
    pendingBillCount: number;
    overdueAmount: number;
    overdueBillCount: number;
    oldestOverdueDueDate: string | null;
    maxOverdueDays: number;
    creditAmtLimit: number;
    creditBillLimit: number;
    availableCreditAmount: number | null;
    availableBillCount: number | null;
    isAmtLimitExceeded: boolean;
    isBillLimitExceeded: boolean;
    isCreditCheckEnabled: boolean;
}
