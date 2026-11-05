export declare class ChequeKeysDto {
    apdId: string;
    apdAccYear: string;
    apdCompanyId: string;
    apdBranchId: string;
}
export declare class ChequeRefDto {
    apdId: string;
    apdAccYear: string;
}
export declare class ChequeAllocationDto {
    billId: string;
    billAccYear: string;
    amount: number;
    discount?: number;
    writeoff?: number;
    writeoffApprovedBy?: string | null;
}
export declare class ChequeRemarksDto {
    remarks?: string | null;
}
export declare class DepositSlipKeyDto {
    slipNo: string;
}
