export declare class ReceiptKeysDto {
    avhVoucherId: string;
    avhCompanyId: string;
    avhBranchId: string;
    avhAccYear: string;
}
export declare class PostReceiptAllocationDto {
    billId: string;
    billAccYear: string;
    amount: number;
    discount?: number;
    writeoff?: number;
    roundoff?: number;
    writeoffApprovedBy?: string | null;
}
export declare class PostReceiptCreditDto {
    billId: string;
    billAccYear: string;
    amount: number;
}
export declare class PostReceiptOtherLinePinDto {
    lineNo: number;
    billId: string;
    billAccYear: string;
    amount: number;
}
export declare class PostReceiptDto extends ReceiptKeysDto {
    allocations: PostReceiptAllocationDto[];
    creditsApplied: PostReceiptCreditDto[];
    otherLineBills: PostReceiptOtherLinePinDto[];
    onAccount: number;
}
export declare class CancelReceiptDto extends ReceiptKeysDto {
    reason: string;
}
export declare class GetReceiptQueryDto extends ReceiptKeysDto {
}
export declare class DeleteReceiptDto extends ReceiptKeysDto {
}
