import { AdjustableCreditBillType, AdjustableCreditStatus, BillAdjType, BillSettlementMode } from '../types/transaction-api.types';
export declare class TransactionErrorFieldDto {
    field: string;
    message: string;
}
export declare class TransactionErrorResponseDto {
    success: false;
    message: string;
    errors: TransactionErrorFieldDto[];
}
export declare class AdjustableCreditDto {
    billId: string;
    billAccYear: string;
    billType: AdjustableCreditBillType;
    docRefno: string;
    docDate: string;
    billAmount: number;
    pendingAmount: number;
    status: AdjustableCreditStatus;
    srcModule: string | null;
    srcDocType: string | null;
    srcDocId: string | null;
    srcAccYear: string | null;
    narration: string | null;
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
}
export declare class AdjustableCreditListSuccessDto {
    success: true;
    message: string;
    data: AdjustableCreditDto[];
}
