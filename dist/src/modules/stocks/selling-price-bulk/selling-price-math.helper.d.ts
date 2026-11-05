import type { PriceLevel, SellingPriceLevelValue } from './types/selling-price-bulk.types';
export declare function exclusiveOfTax(withTax: number, taxPerc: number): number;
export declare function recomputeLevel(level: PriceLevel, price: number, taxPerc: number, costRate: number): SellingPriceLevelValue;
