import type { StockErrorDetail, StockErrorResponse } from "../../../../common/utils/module-service.utils";
export type { StockErrorDetail, StockErrorResponse };
export type { PagedResult } from '../../stock-voucher/types/stock-voucher.types';
export declare const PRICE_SOURCES: readonly ["BUCKET", "MASTER"];
export type PriceSource = (typeof PRICE_SOURCES)[number];
export declare const PRICE_SCOPES: readonly ["BRANCH", "CHAIN"];
export type PriceScope = (typeof PRICE_SCOPES)[number];
export declare const PRICE_LEVELS: readonly [1, 2, 3, 4];
export type PriceLevel = (typeof PRICE_LEVELS)[number];
export declare const LEVEL_COLUMN_SUFFIX: Readonly<Record<PriceLevel, 'a' | 'b' | 'c' | 'd'>>;
export declare const BELOW_COST_PRICE_SETTING_KEY = "inventory.below_cost_price";
export declare const BELOW_COST_POLICIES: readonly ["restrict", "warning", "allow"];
export type BelowCostPolicy = (typeof BELOW_COST_POLICIES)[number];
export declare const DEFAULT_BELOW_COST_POLICY: BelowCostPolicy;
export declare const BELOW_COST_ACTIONS: readonly ["ABORT", "CONFIRM", "PROCEED"];
export type BelowCostAction = (typeof BELOW_COST_ACTIONS)[number];
export declare const PRICE_VERDICTS: readonly ["ABOVE_MRP", "BELOW_MIN", "BELOW_COST"];
export type PriceVerdict = (typeof PRICE_VERDICTS)[number];
export declare const CONFIRMABLE_VERDICTS: readonly PriceVerdict[];
export declare const HQ_USER_TYPES: readonly string[];
export declare function isHqUserType(userType: string | null | undefined): boolean;
export interface SellingPriceLevelValue {
    level: PriceLevel;
    markupPerc: number;
    priceWot: number;
    price: number;
    marginPerc: number;
}
export interface SellingPriceRow {
    lineNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string;
    unitName: string | null;
    stockQty: number;
    mrp: number | null;
    salePrice: number | null;
    priceSource: PriceSource;
    priceScope: PriceScope;
    bucketId: string | null;
    costRate: number;
    minPrice: number;
    roundOff: number;
    taxPerc: number;
    inclTax: boolean;
    hasCess: boolean;
    levels: SellingPriceLevelValue[];
}
export interface ItemTaxRate {
    itemId: string;
    taxId: string | null;
    taxPerc: number;
    inclTax: boolean;
    hasCess: boolean;
}
export interface SellingPriceProblem {
    lineNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string;
    bucketId: string | null;
    level: PriceLevel | null;
    verdict: PriceVerdict;
    message: string;
}
export interface SellingPriceNoStockRow {
    bucketId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string;
    unitName: string | null;
    mrp: number | null;
    salePrice: number | null;
}
export interface SellingPriceSaveResult {
    saved: number;
    masterRowsSaved: number;
    noStock: SellingPriceNoStockRow[];
    needsConfirm: boolean;
    problems: SellingPriceProblem[];
    belowCostPolicy: BelowCostPolicy;
}
export declare const STOCK_MRP_PRICE_NOT_DEPLOYED: string;
