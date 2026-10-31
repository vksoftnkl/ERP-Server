import { type StockVoucherStatus } from '../../stock-voucher/types/stock-voucher.types';
export declare class StockTransferScopeQueryDto {
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare class GetStockTransferQueryDto extends StockTransferScopeQueryDto {
    svhId?: string;
    status?: StockVoucherStatus;
    fromDate?: string;
    toDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
}
export declare class StockTransferRefQueryDto extends StockTransferScopeQueryDto {
    svhId: string;
}
export declare class StockTransferPrefillQueryDto {
    companyId: string;
    branchId: string;
    outVoucherId: string;
    accYear: string;
}
export declare class StockTransferInboundQueryDto {
    companyId: string;
    branchId: string;
    limit?: number;
    offset?: number;
}
