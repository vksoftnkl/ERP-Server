import { PRICE_SCOPES } from '../types/selling-price-bulk.types';
export declare const MAX_SAVE_ROWS = 1000;
export declare class SaveSellingPriceLevelDto {
    level: number;
    price: number;
    priceWot?: number;
    markupPerc?: number;
}
export declare class SaveSellingPriceRowDto {
    lineNo?: number;
    itemId: string;
    uomId: string;
    bucketId?: string | null;
    priceScope?: (typeof PRICE_SCOPES)[number] | null;
    mrp?: number | null;
    salePrice?: number | null;
    levels: SaveSellingPriceLevelDto[];
    minPrice?: number | null;
    roundOff?: number | null;
}
export declare class SaveSellingPriceBulkDto {
    companyId: string;
    branchId: string;
    scope: (typeof PRICE_SCOPES)[number];
    confirmed?: boolean;
    rows: SaveSellingPriceRowDto[];
    userId?: string;
}
