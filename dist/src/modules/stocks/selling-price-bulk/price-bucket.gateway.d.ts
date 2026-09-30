import { Prisma } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { ScopeResolution } from './selling-price-scope.helper';
import { type PagedResult, type PriceLevel, type PriceScope, type PriceSource, type SellingPriceNoStockRow, type SellingPriceProblem } from './types/selling-price-bulk.types';
export interface ListSellingPricesArgs {
    companyId: string;
    branchId: string;
    itemGroupId?: string;
    itemBrandId?: string;
    itemSectionId?: string;
    supplierId?: string;
    limit: number;
    offset: number;
}
export interface OpeningSeedBucket {
    mrp: number;
    salePrice: number;
}
export interface OpeningSeedBucketArgs {
    companyId: string | null;
    branchId: string | null;
    itemId: string;
    uomId: string;
    onDate: string;
}
export interface PriceGridRecord {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string;
    unitName: string | null;
    stockQty: number;
    mrp: number | null;
    salePrice: number | null;
    maxPrice: number;
    priceSource: PriceSource;
    priceScope: PriceScope | null;
    bucketId: string | null;
    costRate: number;
    minPrice: number;
    roundOff: number;
    prices: [number, number, number, number];
}
export interface RowCost {
    itemCode: string | null;
    itemName: string;
    uomBelongs: boolean;
    trackMrp: boolean;
    trackSalePrice: boolean;
    costRate: number;
    costWot: number;
    minPrice: number;
}
export interface BucketLevelWrite {
    level: PriceLevel;
    price: number;
    priceWot: number;
    markupPerc: number;
}
export interface BucketPriceCandidate {
    lineNo: number;
    companyId: string;
    itemId: string;
    uomId: string;
    itemCode: string | null;
    itemName: string;
    bucketId: string | null;
    mrp: number | null;
    salePrice: number | null;
    levels: BucketLevelWrite[];
    minPrice: number | null;
    roundOff: number | null;
    costRate: number;
    costWot: number;
    actor: string;
}
export declare class PriceBucketGateway {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findOpeningSeedBucket(args: OpeningSeedBucketArgs): Promise<OpeningSeedBucket | null>;
    listPrices(args: ListSellingPricesArgs): Promise<PagedResult<PriceGridRecord>>;
    listBuckets(itemId: string, companyId: string, branchId: string): Promise<PriceGridRecord[]>;
    loadRowCosts(tx: Prisma.TransactionClient, rows: ReadonlyArray<{
        itemId: string;
        uomId: string;
        mrp: number | null;
        salePrice: number | null;
    }>, companyId: string, branchId: string): Promise<RowCost[]>;
    validateRows(candidates: readonly BucketPriceCandidate[], storedMinPrices: readonly number[]): SellingPriceProblem[];
    findBucketRowForUpdate(tx: Prisma.TransactionClient, candidate: BucketPriceCandidate, scope: ScopeResolution): Promise<{
        ipmId: string;
    } | null>;
    updateBucketPrice(tx: Prisma.TransactionClient, ipmId: string, candidate: BucketPriceCandidate): Promise<string>;
    insertBucketPrice(tx: Prisma.TransactionClient, candidate: BucketPriceCandidate, scope: ScopeResolution): Promise<string>;
    snapshotRows(tx: Prisma.TransactionClient, ipmIds: readonly string[]): Promise<Map<string, Prisma.JsonObject>>;
    listNoStock(tx: Prisma.TransactionClient, ipmIds: readonly string[], companyId: string, branchId: string): Promise<SellingPriceNoStockRow[]>;
    private gridStatement;
    private toGridRecord;
    private levelColumns;
    private actorColumn;
}
