import { type StockAdjustmentSaveKind } from '../stock-adjustment.rules';
export declare const REASON_DIRECTIONS: readonly ["IN", "OUT", "BOTH"];
export type ReasonDirection = (typeof REASON_DIRECTIONS)[number];
export declare class StockReasonPickerQueryDto {
    companyId: string;
    voucherType: StockAdjustmentSaveKind;
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
