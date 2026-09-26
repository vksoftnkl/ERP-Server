import { Prisma } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { ScopeResolution } from './selling-price-scope.helper';
import { type PagedResult, type PriceLevel, type SellingPriceNoStockRow, type SellingPriceProblem, type SellingPriceRow } from './types/selling-price-bulk.types';
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
    bucketId: string | null;
    mrp: number | null;
    salePrice: number | null;
    levels: BucketLevelWrite[];
    minPrice: number | null;
    roundOff: number | null;
    actor: string;
}
export declare class StockMrpPriceGateway {
    private readonly prisma;
    constructor(prisma: PrismaService);
    readonly isDeployed: boolean;
    findOpeningSeedBucket(args: OpeningSeedBucketArgs): Promise<OpeningSeedBucket | null>;
    listPrices(_args: ListSellingPricesArgs): Promise<PagedResult<SellingPriceRow>>;
    listBuckets(_itemId: string, _companyId: string, _branchId: string): Promise<SellingPriceRow[]>;
    validateRows(_tx: Prisma.TransactionClient, _candidates: readonly BucketPriceCandidate[], _scope: ScopeResolution[]): Promise<SellingPriceProblem[]>;
    findBucketRowForUpdate(_tx: Prisma.TransactionClient, _candidate: BucketPriceCandidate, _scope: ScopeResolution): Promise<{
        smpId: string;
    } | null>;
    updateBucketPrice(_tx: Prisma.TransactionClient, _smpId: string, _candidate: BucketPriceCandidate): Promise<string>;
    insertBucketPrice(_tx: Prisma.TransactionClient, _candidate: BucketPriceCandidate, _scope: ScopeResolution): Promise<string>;
    listNoStock(_tx: Prisma.TransactionClient, _smpIds: readonly string[], _branchId: string): Promise<SellingPriceNoStockRow[]>;
    private notDeployed;
}
