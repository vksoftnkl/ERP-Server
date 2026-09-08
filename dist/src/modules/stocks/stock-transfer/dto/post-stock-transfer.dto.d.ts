export declare class StockTransferRefDto {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    userId?: string;
}
export declare class DespatchStockTransferDto extends StockTransferRefDto {
    lrNo?: string | null;
    vehicleNo?: string | null;
    expectedOn?: string | null;
}
export declare class CancelStockTransferDto extends StockTransferRefDto {
    reason: string;
}
