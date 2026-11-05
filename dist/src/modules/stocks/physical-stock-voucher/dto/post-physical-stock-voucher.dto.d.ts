export declare class PostPhysicalStockVoucherDto {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    userId?: string;
}
export declare class CancelPhysicalStockVoucherDto extends PostPhysicalStockVoucherDto {
    reason: string;
}
