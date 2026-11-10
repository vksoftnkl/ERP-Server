import { ItemPriceMaster, Prisma } from '@prisma/client';
import { type BucketPriceCandidate } from "../../stocks/selling-price-bulk/price-bucket.gateway";
import type { ScopeResolution } from "../../stocks/selling-price-bulk/selling-price-scope.helper";
import { PriceChangeLogService } from './price-change-log.service';
import { type PriceWriteOrigin } from './types/price-change-log.types';
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
    updateBucketPrice(tx: Prisma.TransactionClient, ipmId: string, candidate: BucketPriceCandidate, origin?: PriceWriteOrigin): Promise<string>;
    insertBucketPrice(tx: Prisma.TransactionClient, candidate: BucketPriceCandidate, scope: ScopeResolution, onDate?: string, origin?: PriceWriteOrigin): Promise<string>;
    closePriceRowBefore(tx: Prisma.TransactionClient, ipmId: string, onDate: string, actor: string, origin?: PriceWriteOrigin): Promise<void>;
    insertSplitPrice(tx: Prisma.TransactionClient, sourceId: string, candidate: BucketPriceCandidate, period: {
        from: string;
        to: string;
    }, origin?: PriceWriteOrigin): Promise<string>;
    softDeletePriceRow(tx: Prisma.TransactionClient, ipmId: string, actor: string, origin?: PriceWriteOrigin): Promise<void>;
    extendPriceRowTo(tx: Prisma.TransactionClient, ipmId: string, effectiveTo: string, actor: string, origin?: PriceWriteOrigin): Promise<void>;
    createQtyPrice<I extends Prisma.ItemQtyPriceInclude>(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, data: Prisma.ItemQtyPriceUncheckedCreateInput, include: I): Promise<Prisma.ItemQtyPriceGetPayload<{
        include: I;
    }>>;
    updateQtyPrice<I extends Prisma.ItemQtyPriceInclude>(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, iqpId: string, data: Prisma.ItemQtyPriceUncheckedUpdateInput, include: I): Promise<Prisma.ItemQtyPriceGetPayload<{
        include: I;
    }>>;
    setQtyPriceDeleted(tx: Prisma.TransactionClient, origin: PriceWriteOrigin, iqpId: string, wasDeleted: boolean, data: Prisma.ItemQtyPriceUncheckedUpdateManyInput): Promise<number>;
    private logAfter;
}
