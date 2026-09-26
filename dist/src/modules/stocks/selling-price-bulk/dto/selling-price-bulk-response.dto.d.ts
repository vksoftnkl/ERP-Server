export declare class SellingPriceErrorFieldDto {
    field: string;
    message: string;
}
export declare class SellingPriceErrorResponseDto {
    success: false;
    message: string;
    errors: SellingPriceErrorFieldDto[];
}
export declare class SellingPriceLevelDto {
    level: number;
    markupPerc: number;
    priceWot: number;
    price: number;
    marginPerc: number;
}
export declare class SellingPriceRowDto {
    lineNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string;
    unitName: string | null;
    stockQty: number;
    mrp: number | null;
    salePrice: number | null;
    priceSource: string;
    priceScope: string;
    bucketId: string | null;
    costRate: number;
    minPrice: number;
    roundOff: number;
    taxPerc: number;
    inclTax: boolean;
    hasCess: boolean;
    levels: SellingPriceLevelDto[];
}
export declare class SellingPriceListMetaDto {
    limit: number;
    offset: number;
    count: number;
}
export declare class SellingPriceListDataDto {
    items: SellingPriceRowDto[];
    meta: SellingPriceListMetaDto;
}
export declare class SellingPriceListSuccessDto {
    success: true;
    message: string;
    data: SellingPriceListDataDto;
}
export declare class SellingPriceBucketsSuccessDto {
    success: true;
    message: string;
    data: SellingPriceRowDto[];
}
export declare class SellingPriceProblemDto {
    lineNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string;
    bucketId: string | null;
    level: number | null;
    verdict: string;
    message: string;
}
export declare class SellingPriceNoStockRowDto {
    bucketId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string;
    unitName: string | null;
    mrp: number | null;
    salePrice: number | null;
}
export declare class SellingPriceSaveDataDto {
    saved: number;
    masterRowsSaved: number;
    noStock: SellingPriceNoStockRowDto[];
    needsConfirm: boolean;
    problems: SellingPriceProblemDto[];
    belowCostPolicy: string;
}
export declare class SellingPriceSaveSuccessDto {
    success: true;
    message: string;
    data: SellingPriceSaveDataDto;
}
