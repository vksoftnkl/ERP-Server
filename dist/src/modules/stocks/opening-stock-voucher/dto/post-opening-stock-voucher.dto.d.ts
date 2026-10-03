export declare class PostOpeningStockVoucherDto {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    userId?: string;
}
export declare class CancelOpeningStockVoucherDto extends PostOpeningStockVoucherDto {
    reason: string;
}
