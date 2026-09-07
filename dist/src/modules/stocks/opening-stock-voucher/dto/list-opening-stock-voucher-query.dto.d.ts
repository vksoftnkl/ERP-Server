import { type StockVoucherStatus } from '../../stock-voucher/types/stock-voucher.types';
export declare class OpeningStockVoucherScopeQueryDto {
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare class GetOpeningStockVoucherQueryDto extends OpeningStockVoucherScopeQueryDto {
    svhId?: string;
    status?: StockVoucherStatus;
    fromDate?: string;
    toDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
}
export declare class OpeningStockVoucherRefQueryDto extends OpeningStockVoucherScopeQueryDto {
    svhId: string;
}
export declare class OpeningStockReportQueryDto extends OpeningStockVoucherScopeQueryDto {
    limit?: number;
    offset?: number;
}
