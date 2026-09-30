import { PrismaService } from "../../../database/prisma/prisma.service";
import { PriceBucketGateway } from '../selling-price-bulk/price-bucket.gateway';
import type { OpeningStockItemLookup, OpeningStockItemLookupArgs } from './types/opening-stock-lookup.types';
export declare class OpeningStockLookupService {
    private readonly prisma;
    private readonly mrpPrices;
    constructor(prisma: PrismaService, mrpPrices: PriceBucketGateway);
    lookupItem(args: OpeningStockItemLookupArgs): Promise<OpeningStockItemLookup>;
    private throwWhyEmpty;
}
