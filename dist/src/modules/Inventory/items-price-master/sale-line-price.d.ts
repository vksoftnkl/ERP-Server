import { CustItemRate, ItemMaster, Prisma } from '@prisma/client';
import type { PriceRowWithUnit } from '../../master-lookup/types/master-lookup-internal.types';
import { type BucketTrackFlags } from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import { type QtySlab } from '../items-qty-price-master/qty-slab.rules';
import { type BucketKey, type PriceCallerScope, type ResolvedPrice } from './price-resolver';
export type SaleLinePriceClient = Pick<Prisma.TransactionClient, 'itemMaster' | 'itemPriceMaster' | 'stockLot' | 'custItemRate' | 'itemQtyPrice' | '$queryRaw'>;
export interface SaleLinePriceQuery {
    itemId: string;
    unitId?: string | null;
    companyId?: string | null;
    branchId?: string | null;
    customerId?: string | null;
    priceLevel: number;
    docDate: string;
    mrp?: number | null;
    salePrice?: number | null;
    lotId?: string | null;
}
export type SaleLinePriceMiss = {
    ok: false;
    reason: 'ITEM_NOT_FOUND';
} | {
    ok: false;
    reason: 'PRICE_NOT_FOUND';
} | {
    ok: false;
    reason: 'LOT_NOT_FOUND';
} | {
    ok: false;
    reason: 'BUCKET_PRICE_NOT_FOUND';
    key: BucketKey;
    priced: BucketKey[];
};
export interface SaleLinePrice {
    ok: true;
    item: ItemMaster;
    caller: PriceCallerScope;
    unitRows: PriceRowWithUnit[];
    policy: BucketTrackFlags;
    key: BucketKey;
    resolved: ResolvedPrice<PriceRowWithUnit>;
    rate: PriceRowWithUnit;
    custRate: CustItemRate | null;
    basePrice: number;
    customerDiscQty: number;
    salesPrice: number;
}
export type SaleLinePriceAnswer = SaleLinePrice | SaleLinePriceMiss;
export declare function resolveSaleLinePrice(client: SaleLinePriceClient, query: SaleLinePriceQuery): Promise<SaleLinePriceAnswer>;
export declare function pricedBuckets(unitRows: PriceRowWithUnit[], docDate: string, caller: PriceCallerScope): Array<{
    key: BucketKey;
    row: PriceRowWithUnit;
    answer: ResolvedPrice<PriceRowWithUnit>;
}>;
export declare function provisionalBucket(unitRows: PriceRowWithUnit[], key: BucketKey, docDate: string, caller: PriceCallerScope): ResolvedPrice<PriceRowWithUnit> | null;
export interface QtyPriceSettingReader {
    resolveEffective(scope: {
        companyId?: string;
        branchId?: string;
    }): Promise<ReadonlyArray<{
        asdKey: string;
        value: string | null;
    }>>;
}
export interface QtySlabQuery {
    itemId: string;
    iucId: string;
    companyId?: string | null;
    branchId?: string | null;
    partyId?: string | null;
    priceLevel: number;
    onDate: string;
}
export declare function rankedQtySlabs(client: SaleLinePriceClient, query: QtySlabQuery, settings?: QtyPriceSettingReader): Promise<QtySlab[]>;
