import { type BucketKey, type PriceCallerScope, type PriceRowScope } from '../items-price-master/price-resolver';
import { type Dec, type QtySlab, type QtySlabRecord, type SlabCard, type SlabJudgement } from '../items-qty-price-master/qty-slab.rules';
import type { SaveItemQtyPriceDto } from '../items-qty-price-master/dto/save-item-qty-price.dto';
import type { BelowCostPolicy } from '../../stocks/selling-price-bulk/types/selling-price-bulk.types';
import type { QtyRatesProblem, QtyRatesSeverity } from './types/item-qty-rates.types';
export declare const BY_USER = "By User";
export declare function dec(value: number | string | Dec | null | undefined): Dec;
export interface CardPriceRecord extends PriceRowScope {
    ipmId: string;
    ipmUcUnitId: string;
    ipmCostPrice: Dec | null;
    ipmCostWot: Dec | null;
    ipmMaxPrice: Dec | null;
    ipmMinPrice: Dec | null;
    ipmProfitType: string | null;
    ipmRoundOff: Dec | null;
    ipmSalesPriceA: Dec | null;
    ipmSalesPriceB: Dec | null;
    ipmSalesPriceC: Dec | null;
    ipmSalesPriceD: Dec | null;
    ipmEffectiveFrom: Date;
    ipmEffectiveTo: Date;
}
export interface StoredCardRow {
    ipmId: string;
    costPrice: Dec;
    costWot: Dec;
    maxPrice: Dec;
    minPrice: Dec;
    profitType: string;
    prices: [Dec, Dec, Dec, Dec];
}
export declare function storedCardRowOf(row: CardPriceRecord): StoredCardRow;
export declare function sameKey(a: BucketKey, b: BucketKey): boolean;
export declare function cardRowOf<R extends CardPriceRecord>(unitRows: readonly R[], today: string, caller: PriceCallerScope): {
    key: BucketKey;
    row: R;
} | null;
export declare function scheduledFromOf<R extends CardPriceRecord>(unitRows: readonly R[], key: BucketKey, today: string, caller: PriceCallerScope): string | null;
export interface SentCardRow {
    index: number;
    lineNo: number;
    uomId: string;
    unitName: string | null;
    key: BucketKey;
    levels: ReadonlyArray<{
        level: number;
        price: Dec;
    }>;
    costPrice: Dec | null;
    maxPrice: Dec | null;
    minPrice: Dec | null;
    profitType: string | null;
    stored: StoredCardRow | null;
}
export declare function pricesAfter(row: Pick<SentCardRow, 'levels' | 'stored'>): [Dec, Dec, Dec, Dec];
export interface CardCheckContext {
    activeLevels: readonly number[];
    levelNames: ReadonlyMap<number, string>;
}
export declare function cardProblems(rows: readonly SentCardRow[], ctx: CardCheckContext): QtyRatesProblem[];
export interface UnitCardInput {
    stored: StoredCardRow | null;
    key: BucketKey;
    sent: SentCardRow | null;
    plainStock: boolean;
    costBasisRate: Dec;
    inclTax: boolean;
    taxPerc: Dec;
}
export declare function unitCardAfter(input: UnitCardInput): SlabCard;
export interface SlabAfterSave {
    slab: QtySlab;
    uomId: string;
    slabIndex: number | null;
    iqpId: string | null;
}
export interface StoredSlab {
    slab: QtySlab;
    uomId: string;
}
export declare function storedSlabOf(record: QtySlabRecord & {
    iqpItemUnitId: string;
}): StoredSlab;
export declare function slabAfterSave(dto: SaveItemQtyPriceDto, stored: StoredSlab | null): StoredSlab;
export declare function slabsToJudge(args: {
    stored: readonly StoredSlab[];
    sent: readonly SaveItemQtyPriceDto[];
    deleteIds: readonly string[];
    companyId: string;
    branchId: string;
    today: string;
}): SlabAfterSave[];
export declare function belowCostSeverity(policy: BelowCostPolicy): QtyRatesSeverity;
export declare function slabProblems(judged: ReadonlyArray<{
    entry: SlabAfterSave;
    unitName: string | null;
    card: SlabCard;
    judgements: SlabJudgement[];
}>, ctx: CardCheckContext & {
    policy: BelowCostPolicy;
}): QtyRatesProblem[];
export declare function judgeSlabs(entries: readonly SlabAfterSave[], cards: ReadonlyMap<string, {
    card: SlabCard;
    unitName: string | null;
}>, activeLevels: readonly number[], basis: SlabCard['basis']): Array<{
    entry: SlabAfterSave;
    unitName: string | null;
    card: SlabCard;
    judgements: SlabJudgement[];
}>;
