import { PrismaService } from "../../../database/prisma/prisma.service";
import { StockMrpPriceGateway } from '../selling-price-bulk/stock-mrp-price.gateway';
import type { OpeningStockItemLookup, OpeningStockItemLookupArgs } from './types/opening-stock-lookup.types';
export declare class OpeningStockLookupService {
    private readonly prisma;
    private readonly mrpPrices;
    constructor(prisma: PrismaService, mrpPrices: StockMrpPriceGateway);
    lookupItem(args: OpeningStockItemLookupArgs): Promise<OpeningStockItemLookup>;
    private throwWhyEmpty;
}
