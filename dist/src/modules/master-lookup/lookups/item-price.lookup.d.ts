import { PrismaService } from '../../../database/prisma/prisma.service';
import { ItemPriceLookupQueryDto } from '../dto/item-price-lookup-query.dto';
import { ItemPriceRefreshQueryDto } from '../dto/item-price-refresh-query.dto';
import { ItemPriceLookupPayload, ItemUnitCyclePayload } from '../types/master-lookup-api.types';
export interface QtyPriceSettingReader {
    resolveEffective(scope: {
        companyId?: string;
        branchId?: string;
    }): Promise<ReadonlyArray<{
        asdKey: string;
        value: string | null;
    }>>;
}
export declare class ItemPriceLookup {
    private readonly prisma;
    private readonly settings?;
    constructor(prisma: PrismaService, settings?: QtyPriceSettingReader | undefined);
    private resolveQtySlabs;
    refreshItemPriceLookup(query: ItemPriceRefreshQueryDto): Promise<ItemUnitCyclePayload>;
    private resolveNextIucId;
    private resolveLoadingCharge;
    private resolveFreightCharge;
    private resolveTaxLedgers;
    private lineBucketValues;
    private pricedBuckets;
    private provisionalBucket;
    private resolveStockBuckets;
    getItemPriceLookup(query: ItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload>;
}
