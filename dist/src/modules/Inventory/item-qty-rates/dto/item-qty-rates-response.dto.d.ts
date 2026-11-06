import { ItemQtyPricePayloadDto } from '../../items-qty-price-master/dto/item-qty-price-response.dto';
export declare class QtyRatesItemDto {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    barcode: string | null;
    groupName: string | null;
    brandName: string | null;
    taxPerc: number;
    inclTax: boolean;
    hasCess: boolean;
    plainStock: boolean;
    trackedAs: string;
    leftOutReason: string | null;
}
export declare class QtyRatesRightsDto {
    view: boolean;
    createSlab: boolean;
    editSlab: boolean;
    deleteSlab: boolean;
    editCard: boolean;
    allBranchSlab: boolean;
}
export declare class QtyRatesLevelDto {
    level: number;
    name: string;
    short: string | null;
}
export declare class QtyRatesUnitLevelDto {
    level: number;
    price: number;
    priceWot: number;
    markupPerc: number;
}
export declare class QtyRatesUnitDto {
    lineNo: number;
    uomId: string;
    unitName: string | null;
    unitSlno: number;
    parentUomId: string | null;
    parentUnitName: string | null;
    unitsPerParent: number | null;
    factorsAgree: boolean;
    bucketId: string | null;
    priceScope: string | null;
    priceSource: string;
    mrp: number | null;
    salePrice: number | null;
    maxPrice: number;
    stockQty: number;
    costRate: number;
    costWot: number;
    costBasis: string | null;
    stockAvg: number | null;
    rowCost: number | null;
    rowCostWot: number | null;
    cardCost: number;
    profitType: string | null;
    roundOff: number;
    minPrice: number;
    levels: QtyRatesUnitLevelDto[];
    costEditable: boolean;
    mrpEditable: boolean;
    scheduledFrom: string | null;
}
export declare class QtyRatesViewDto {
    item: QtyRatesItemDto;
    rights: QtyRatesRightsDto;
    belowCostPolicy: string;
    today: string;
    levels: QtyRatesLevelDto[];
    units: QtyRatesUnitDto[];
    slabs: ItemQtyPricePayloadDto[];
}
export declare class QtyRatesProblemDto {
    source: string;
    code: string;
    severity: string;
    lineNo: number | null;
    slabIndex: number | null;
    iqpId: string | null;
    uomId: string;
    unitName: string | null;
    level: number | null;
    price: number | null;
    cost: number | null;
    field: string;
    message: string;
}
export declare class QtyRatesSaveResultDto {
    needsConfirm: boolean;
    rates: Record<string, unknown> | null;
    slabs: ItemQtyPricePayloadDto[];
    deletedSlabIds: string[];
    problems: QtyRatesProblemDto[];
    belowCostPolicy: string;
}
export declare class QtyRatesViewSuccessDto {
    success: boolean;
    message: string;
    data: QtyRatesViewDto;
}
export declare class QtyRatesSaveSuccessDto {
    success: boolean;
    message: string;
    data: QtyRatesSaveResultDto;
}
