export declare class OpeningStockVoucherScopeQueryDto {
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare class GetOpeningStockVoucherQueryDto extends OpeningStockVoucherScopeQueryDto {
    svhId: string;
}
export declare class OpeningStockVoucherRefQueryDto extends OpeningStockVoucherScopeQueryDto {
    svhId: string;
}
export declare class OpeningStockReportQueryDto extends OpeningStockVoucherScopeQueryDto {
    limit?: number;
    offset?: number;
}
export declare class OpeningStockItemLookupQueryDto {
    companyId?: string | null;
    branchId?: string | null;
    itemId: string;
    uomId?: string;
    onDate: string;
}
