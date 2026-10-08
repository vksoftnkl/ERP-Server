export declare const DEFAULT_PRICE_GRID_LIMIT = 200;
export declare const MAX_PRICE_GRID_LIMIT = 1000;
export declare class ListSellingPriceQueryDto {
    companyId: string;
    branchId: string;
    itemGroupId?: string;
    itemBrandId?: string;
    itemSectionId?: string;
    supplierId?: string;
    itemId?: string;
    search?: string;
    itemCategoryId?: string;
    trackPresetId?: string;
    taxId?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
}
