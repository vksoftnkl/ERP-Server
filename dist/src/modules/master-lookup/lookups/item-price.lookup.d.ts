import { PrismaService } from '../../../database/prisma/prisma.service';
import { ItemPriceLookupQueryDto } from '../dto/item-price-lookup-query.dto';
import { ItemPriceRefreshQueryDto } from '../dto/item-price-refresh-query.dto';
import { ItemPriceLookupPayload, ItemUnitCyclePayload } from '../types/master-lookup-api.types';
export declare class ItemPriceLookup {
    private readonly prisma;
    constructor(prisma: PrismaService);
    refreshItemPriceLookup(query: ItemPriceRefreshQueryDto): Promise<ItemUnitCyclePayload>;
    private resolveNextIucId;
    private resolveLoadingCharge;
    private resolveFreightCharge;
    getItemPriceLookup(query: ItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload>;
}
