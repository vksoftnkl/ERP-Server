import { PROFIT_TYPES } from '../types/cost-price-bulk.types';
export declare class ListCostPriceBulkQueryDto {
    companyId: string;
    branchId: string;
    groupId?: string;
    itemCategoryId?: string;
    brandId?: string;
    sectionId?: string;
    supplierId?: string;
    profitType?: (typeof PROFIT_TYPES)[number];
    priceListOnly?: boolean;
    itemId?: string;
    page?: number;
    limit?: number;
}
