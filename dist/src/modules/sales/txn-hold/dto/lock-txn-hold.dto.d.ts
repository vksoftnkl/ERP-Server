export declare class LockTxnHoldDto {
    txhCompanyId: string;
    txhBranchId: string;
    txhAccYear?: string;
    lockTtlSeconds?: number;
    txhLockToken?: string | null;
}
export declare class ConvertTxnHoldDto extends LockTxnHoldDto {
    txhConvertedDocId: string;
    txhConvertedAccYear: string;
    txhConvertedRefno?: string | null;
    txhConvertedBy?: string | null;
}
