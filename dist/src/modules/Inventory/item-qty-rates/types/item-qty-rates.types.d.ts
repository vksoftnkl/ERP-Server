import type { ItemQtyPricePayload } from '../../items-qty-price-master/types/item-qty-price-api.types';
import type { LeftOutReason } from '../../../stocks/cost-price-bulk/types/cost-price-bulk.types';
import type { BelowCostPolicy, CostBasis, PriceScope, PriceSource, SellingPriceSaveResult } from '../../../stocks/selling-price-bulk/types/selling-price-bulk.types';
export declare const QTY_RATES_MENU_ID = 244;
export declare const MAX_QTY_RATES_CARD_ROWS = 200;
export declare const MAX_QTY_RATES_SLABS = 500;
export interface QtyRatesItem {
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
    leftOutReason: Exclude<LeftOutReason, 'NO_PRICE_ROW'> | null;
}
export interface QtyRatesRights {
    view: boolean;
    createSlab: boolean;
    editSlab: boolean;
    deleteSlab: boolean;
    editCard: boolean;
    allBranchSlab: boolean;
}
export interface QtyRatesLevel {
    level: number;
    name: string;
    short: string | null;
}
export interface QtyRatesUnitLevel {
    level: number;
    price: number;
    priceWot: number;
    markupPerc: number;
}
export interface QtyRatesUnit {
    lineNo: number;
    uomId: string;
    unitName: string | null;
    unitSlno: number;
    parentUomId: string | null;
    parentUnitName: string | null;
    unitsPerParent: number | null;
    factorsAgree: boolean;
    bucketId: string | null;
    priceScope: PriceScope | null;
    priceSource: PriceSource;
    mrp: number | null;
    salePrice: number | null;
    maxPrice: number;
    stockQty: number;
    costRate: number;
    costWot: number;
    costBasis: CostBasis | null;
    stockAvg: number | null;
    rowCost: number | null;
    rowCostWot: number | null;
    cardCost: number;
    profitType: string | null;
    roundOff: number;
    minPrice: number;
    levels: QtyRatesUnitLevel[];
    costEditable: boolean;
    mrpEditable: boolean;
    scheduledFrom: string | null;
}
export interface QtyRatesView {
    item: QtyRatesItem;
    rights: QtyRatesRights;
    belowCostPolicy: BelowCostPolicy;
    today: string;
    levels: QtyRatesLevel[];
    units: QtyRatesUnit[];
    slabs: ItemQtyPricePayload[];
}
export type QtyRatesProblemSource = 'CARD' | 'SLAB';
export type QtyRatesSeverity = 'REFUSE' | 'ASK' | 'INFO';
export interface QtyRatesProblem {
    source: QtyRatesProblemSource;
    code: string;
    severity: QtyRatesSeverity;
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
export interface QtyRatesSaveResult {
    needsConfirm: boolean;
    rates: SellingPriceSaveResult | null;
    slabs: ItemQtyPricePayload[];
    deletedSlabIds: string[];
    problems: QtyRatesProblem[];
    belowCostPolicy: BelowCostPolicy;
}
