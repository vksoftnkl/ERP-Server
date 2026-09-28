import { type StockBucket } from '../../stock-voucher/types/stock-voucher.types';
export declare class StockAdjustmentScopeQueryDto {
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare class StockAdjustmentRefQueryDto extends StockAdjustmentScopeQueryDto {
    svhId: string;
}
export declare class StockAdjustmentRefDto {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    userId?: string;
}
export declare class CancelStockAdjustmentDto extends StockAdjustmentRefDto {
    reason: string;
}
export declare class PickStockQueryDto {
    companyId: string;
    branchId: string;
    godownId: string;
    itemId?: string;
    bucket?: StockBucket;
    search?: string;
    limit?: number;
}
