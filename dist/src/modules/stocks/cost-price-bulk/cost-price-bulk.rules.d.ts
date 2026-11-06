import { Prisma } from '@prisma/client';
import type { PriceRowLevelWrite, PriceRowRewrite } from '../../Inventory/item-price-log/price-master-writer.service';
import type { BelowCostPolicy } from '../selling-price-bulk/types/selling-price-bulk.types';
import { type CostBulkCounts, type CostBulkNote, type LeftOutReason } from './types/cost-price-bulk.types';
export type Dec = Prisma.Decimal;
export declare function dec(value: number | string | Dec): Dec;
export interface EligibilityFlags {
    isActive: boolean;
    isBatchBased: boolean;
    presetTracks: boolean;
}
export declare function leftOutReasonOf(flags: EligibilityFlags): Exclude<LeftOutReason, 'NO_PRICE_ROW'> | null;
export declare function trackedAsOf(presetName: string | null | undefined): string;
export declare function leftOutReasonText(reason: LeftOutReason, trackedAs: string): string;
export interface UnitLinkInput {
    parentToBase: Dec | null;
    toBase: Dec;
    unitFactor: Dec;
}
export declare const UNIT_FACTOR_TOLERANCE: Prisma.Decimal;
export declare function unitLink(input: UnitLinkInput): {
    unitsPerParent: Dec | null;
    factorsAgree: boolean;
};
export declare function exclusiveOfTax(withTax: Dec, taxPerc: Dec): Dec;
export declare function levelFigures(price: Dec, taxPerc: Dec, cost: Dec): PriceRowLevelWrite;
export declare const TOKEN_IGNORED_COLUMNS: readonly string[];
export interface StoredPriceRow {
    ipmId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitName: string | null;
    usable: boolean;
    current: boolean;
    eligibility: EligibilityFlags;
    isChain: boolean;
    companyShared: boolean;
    rowToken: string;
    costPrice: Dec;
    maxPrice: Dec;
    minPrice: Dec;
    profitType: string;
    prices: readonly [Dec, Dec, Dec, Dec];
}
export interface RowRequest {
    index: number;
    lineNo: number;
    ipmId: string;
    rowToken: string;
    costPrice: Dec;
    mrp?: Dec | null;
    minPrice?: Dec | null;
    profitType?: string | null;
    levels?: ReadonlyArray<{
        level: number;
        price: Dec;
    }>;
}
export interface RowContext {
    taxPerc: Dec;
    isHq: boolean;
    belowCostPolicy: BelowCostPolicy;
    levelNames: readonly [string, string, string, string];
    levelActive: readonly [boolean, boolean, boolean, boolean];
    actor: string;
}
export declare const MAX_MARKUP_PERC: Prisma.Decimal;
export interface RowPlan {
    lineNo: number;
    ipmId: string;
    refusals: CostBulkNote[];
    warnings: CostBulkNote[];
    changed: boolean;
    companyCopy: boolean;
    write: PriceRowRewrite | null;
}
export declare function money(value: Dec): string;
export declare function planRow(request: RowRequest, row: StoredPriceRow | null, ctx: RowContext): RowPlan;
export interface OverrideRequest {
    code: string;
    line?: number | null;
}
export declare function isOverridden(warning: CostBulkNote, overrides: readonly OverrideRequest[]): boolean;
export declare function blockingNotes(plans: readonly RowPlan[], overrides: readonly OverrideRequest[]): CostBulkNote[];
export declare function countsOf(plans: readonly RowPlan[]): CostBulkCounts;
export declare function tickedReason(plan: RowPlan): string | null;
