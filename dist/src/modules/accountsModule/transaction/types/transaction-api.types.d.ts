import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
export type TransactionErrorDetail = ModuleApiErrorDetail;
export type TransactionErrorResponse = ModuleApiErrorResponse<TransactionErrorDetail>;
export type TransactionSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export declare enum AdjustableCreditBillType {
    ADVANCE = "ADVANCE",
    SALES_RETURN = "SALES_RETURN"
}
export declare enum BillAdjType {
    ADVANCE_ADJUST = "ADVANCE_ADJUST",
    NOTE_ADJUST = "NOTE_ADJUST"
}
export declare enum BillSettlementMode {
    ADVANCE = "ADVANCE",
    CREDIT_NOTE = "CREDIT_NOTE"
}
export declare enum AdjustableCreditSide {
    CR = "CR",
    DR = "DR"
}
export declare const DEFAULT_ADJUSTABLE_CREDIT_SIDE = AdjustableCreditSide.CR;
export declare enum AdjustableCreditStatus {
    OPEN = "OPEN",
    PARTIAL = "PARTIAL"
}
export declare const CREDIT_ADJUSTMENT_ROUTING: Readonly<Record<AdjustableCreditBillType, {
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
}>>;
export interface AdjustableCredit {
    billId: string;
    billAccYear: string;
    billType: AdjustableCreditBillType;
    drCr: AdjustableCreditSide;
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
