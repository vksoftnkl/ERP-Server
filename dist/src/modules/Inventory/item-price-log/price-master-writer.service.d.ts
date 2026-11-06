import { ItemPriceMaster, Prisma } from '@prisma/client';
import { type BucketPriceCandidate } from "../../stocks/selling-price-bulk/price-bucket.gateway";
import type { ScopeResolution } from "../../stocks/selling-price-bulk/selling-price-scope.helper";
import { PriceChangeLogService } from './price-change-log.service';
import { type PriceRowSnapshot, type PriceWriteOrigin } from './types/price-change-log.types';
export type PriceCandidateWrite = BucketPriceCandidate & {
    profitType?: string | null;
};
export interface PriceRowLevelWrite {
    price: Prisma.Decimal;
    priceWot: Prisma.Decimal;
    markupPerc: Prisma.Decimal;
}
export interface PriceRowRewrite {
    ipmId: string;
    costPrice: Prisma.Decimal;
    costWot: Prisma.Decimal;
    maxPrice: Prisma.Decimal;
    minPrice: Prisma.Decimal;
    profitType: string;
    levels: readonly [PriceRowLevelWrite, PriceRowLevelWrite, PriceRowLevelWrite, PriceRowLevelWrite];
    reason?: string | null;
}
export interface PriceBucketWrite {
    mrp: number | null;
    salePrice: number | null;
}
export declare class PriceMasterWriter {
    private readonly changeLog;
    constructor(changeLog: PriceChangeLogService);
    createPrice(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, data: Prisma.ItemPriceMasterUncheckedCreateInput): Promise<ItemPriceMaster>;
    updatePrice(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, ipmId: string, data: Prisma.ItemPriceMasterUncheckedUpdateInput): Promise<ItemPriceMaster>;
    rekeyPrice(tx: Prisma.TransactionClient, ipmId: string, key: PriceBucketWrite, updatedOn: Date): Promise<void>;
    updateBucketPrice(tx: Prisma.TransactionClient, ipmId: string, candidate: PriceCandidateWrite, origin?: PriceWriteOrigin): Promise<string>;
    insertBucketPrice(tx: Prisma.TransactionClient, candidate: PriceCandidateWrite, scope: ScopeResolution, onDate?: string, origin?: PriceWriteOrigin): Promise<string>;
    closePriceRowBefore(tx: Prisma.TransactionClient, ipmId: string, onDate: string, actor: string, origin?: PriceWriteOrigin): Promise<void>;
    insertSplitPrice(tx: Prisma.TransactionClient, sourceId: string, candidate: PriceCandidateWrite, period: {
        from: string;
        to: string;
    }, origin?: PriceWriteOrigin): Promise<string>;
    softDeletePriceRow(tx: Prisma.TransactionClient, ipmId: string, actor: string, origin?: PriceWriteOrigin): Promise<void>;
    extendPriceRowTo(tx: Prisma.TransactionClient, ipmId: string, effectiveTo: string, actor: string, origin?: PriceWriteOrigin): Promise<void>;
    rewritePriceRows(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, rows: readonly PriceRowRewrite[], actor: string): Promise<{
        before: Map<string, PriceRowSnapshot>;
        after: Map<string, PriceRowSnapshot>;
    }>;
    insertCompanyPriceRows(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, companyId: string, rows: readonly PriceRowRewrite[], actor: string): Promise<Map<string, {
        ipmId: string;
        after: PriceRowSnapshot | null;
    }>>;
    createQtyPrice<I extends Prisma.ItemQtyPriceInclude>(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, data: Prisma.ItemQtyPriceUncheckedCreateInput, include: I): Promise<Prisma.ItemQtyPriceGetPayload<{
        include: I;
    }>>;
    updateQtyPrice<I extends Prisma.ItemQtyPriceInclude>(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, iqpId: string, data: Prisma.ItemQtyPriceUncheckedUpdateInput, include: I): Promise<Prisma.ItemQtyPriceGetPayload<{
        include: I;
    }>>;
    setQtyPriceDeleted(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, iqpId: string, wasDeleted: boolean, data: Prisma.ItemQtyPriceUncheckedUpdateManyInput): Promise<number>;
    private logAfter;
}
