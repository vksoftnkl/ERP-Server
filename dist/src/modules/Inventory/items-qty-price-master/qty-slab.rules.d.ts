import { Prisma } from '@prisma/client';
export type Dec = Prisma.Decimal;
export declare const QTY_PRICE_MODES: readonly ["P", "R", "F"];
export type QtyPriceMode = (typeof QTY_PRICE_MODES)[number];
export declare const SELLING_SLAB_LEVELS: readonly [1, 2, 3, 4];
export declare const APPLY_QTY_PRICES_SETTING_KEY = "sales.apply_qty_prices";
export interface QtySlab {
    iqpId: string;
    companyId: string | null;
    branchId: string | null;
    partyId: string | null;
    priceLevel: number | null;
    fromQty: Dec;
    toQty: Dec | null;
    priceMode: string;
    discPct: Dec | null;
    flatOff: Dec | null;
    price: Dec | null;
    isTaxIncl: boolean;
    effectiveFrom: string;
    effectiveTo: string | null;
    isActive: boolean;
    modifiedOn?: string | null;
}
export interface QtySlabRecord {
    iqpId: string;
    iqpCompanyId: string | null;
    iqpBranchId: string | null;
    iqpPartyId: string | null;
    iqpPriceLevel: number | null;
    iqpFromQty: Dec;
    iqpToQty: Dec | null;
    iqpPriceMode: string;
    iqpDiscPct: Dec | null;
    iqpFlatOff: Dec | null;
    iqpPrice: Dec | null;
    iqpIsTaxIncl: boolean;
    iqpEffectiveFrom: Date;
    iqpEffectiveTo: Date | null;
    iqpIsActive: boolean;
    iqpModifiedOn?: Date | null;
}
export declare function dayOf(value: Date): string;
export declare function qtySlabOf(record: QtySlabRecord): QtySlab;
export interface SlabScope {
    companyId?: string | null;
    branchId?: string | null;
    partyId?: string | null;
    priceLevel: number;
    onDate: string;
}
export declare function isSellingSlabLevel(level: number | null | undefined, activeLevels: Iterable<number>): boolean;
export declare function slabSpecificity(slab: Pick<QtySlab, 'partyId' | 'priceLevel' | 'branchId' | 'companyId'>): number;
export declare function slabInForce(slab: Pick<QtySlab, 'effectiveFrom' | 'effectiveTo'>, day: string): boolean;
export declare function slabInForceOnOrAfter(slab: Pick<QtySlab, 'effectiveTo'>, day: string): boolean;
export declare function slabAppliesTo(slab: QtySlab, scope: SlabScope): boolean;
export declare function rankSlabs<T extends QtySlab>(slabs: readonly T[]): T[];
export declare function slabsFor<T extends QtySlab>(slabs: readonly T[], scope: SlabScope): T[];
export declare function slabHoldsQty(slab: Pick<QtySlab, 'fromQty' | 'toQty'>, qty: Dec): boolean;
export declare function pickSlab<T extends QtySlab>(ranked: readonly T[], qty: Dec): T | null;
export declare function toTaxBasis(amount: Dec, fromInclTax: boolean, toInclTax: boolean, taxPerc: Dec): Dec;
export interface PriceBasis {
    inclTax: boolean;
    taxPerc: Dec;
}
export declare function slabUnitPrice(base: Dec, slab: Pick<QtySlab, 'priceMode' | 'discPct' | 'flatOff' | 'price' | 'isTaxIncl'>, basis: PriceBasis): Dec | null;
export declare function slabLineRate(base: Dec, slab: Pick<QtySlab, 'priceMode' | 'discPct' | 'flatOff' | 'price' | 'isTaxIncl'>, basis: PriceBasis): Dec | null;
export declare function isApplyQtyPricesOn(effective: ReadonlyArray<{
    asdKey: string;
    value: string | null;
}>): boolean;
export interface SlabCard {
    prices: readonly [Dec, Dec, Dec, Dec];
    hasPriceRow: boolean;
    cost: Dec;
    mrp: Dec;
    min: Dec;
    basis: PriceBasis;
}
export type SlabVerdict = 'ZERO_OR_LESS' | 'ABOVE_MRP' | 'BELOW_MIN' | 'BELOW_COST';
export interface SlabJudgement {
    level: number | null;
    base: Dec | null;
    each: Dec;
    verdict: SlabVerdict;
}
export declare function judgeSlab(slab: QtySlab, card: SlabCard, activeLevels: Iterable<number>): SlabJudgement[];
