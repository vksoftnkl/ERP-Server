import { type StockBucket, type StockVoucherStatus } from '../../stock-voucher/types/stock-voucher.types';
export declare class PhysicalStockVoucherScopeQueryDto {
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare class GetPhysicalStockVoucherQueryDto extends PhysicalStockVoucherScopeQueryDto {
    svhId?: string;
    status?: StockVoucherStatus;
    fromDate?: string;
    toDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
}
export declare class PhysicalStockVoucherRefQueryDto extends PhysicalStockVoucherScopeQueryDto {
    svhId: string;
}
export declare class PhysicalStockVarianceQueryDto extends PhysicalStockVoucherRefQueryDto {
    limit?: number;
    offset?: number;
}
export declare class GenerateCountSheetQueryDto extends PhysicalStockVoucherScopeQueryDto {
    godownId: string;
    bucket?: StockBucket;
    itemGroupId?: string;
    includeZero?: boolean;
    limit?: number;
    offset?: number;
}
