import { type StockAdjustmentSaveKind } from '../stock-adjustment.rules';
export declare const REASON_DIRECTIONS: readonly ["IN", "OUT", "BOTH"];
export type ReasonDirection = (typeof REASON_DIRECTIONS)[number];
export declare const TRANSFER_REASON_KINDS: readonly ["TRANSFER_OUT", "TRANSFER_IN"];
export type TransferReasonKind = (typeof TRANSFER_REASON_KINDS)[number];
export declare const STOCK_REASON_PICKER_KINDS: readonly ["ADJUSTMENT", "ISSUE", "DAMAGE", "EXPIRY_WRITEOFF", "BUCKET_MOVE", "TRANSFER_OUT", "TRANSFER_IN"];
export declare class StockReasonPickerQueryDto {
    companyId: string;
    voucherType: StockAdjustmentSaveKind | TransferReasonKind;
    direction?: 'IN' | 'OUT';
}
export declare class StockReasonListQueryDto {
    companyId: string;
    includeInactive?: boolean;
}
export declare class StockReasonRefQueryDto {
    companyId: string;
    srmId: string;
}
export declare class SaveStockReasonDto {
    srmId?: string;
    companyId: string;
    code: string;
    name: string;
    direction: ReasonDirection;
    allowedTxnTypes?: string[];
    requireRemarks?: boolean;
    glLedgerId?: string | null;
    sortOrder?: number;
    remarks?: string | null;
    isActive?: boolean;
    userId?: string;
}
export declare class DeactivateStockReasonDto {
    companyId: string;
    srmId: string;
    reactivate?: boolean;
    userId?: string;
}
