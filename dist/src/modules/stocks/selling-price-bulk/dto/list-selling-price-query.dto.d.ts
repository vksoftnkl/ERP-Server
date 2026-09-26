export declare const DEFAULT_PRICE_GRID_LIMIT = 200;
export declare const MAX_PRICE_GRID_LIMIT = 1000;
export declare class ListSellingPriceQueryDto {
    companyId: string;
    branchId: string;
    itemGroupId?: string;
    itemBrandId?: string;
    itemSectionId?: string;
    supplierId?: string;
    limit?: number;
    offset?: number;
}
