import { PrismaService } from "../../../database/prisma/prisma.service";
import { GetItemBatchStockQueryDto } from './dto/get-item-batch-stock-query.dto';
import { ItemBatchStockPayload } from './types/item-batch-stock-api.types';
export declare class ItemBatchStockService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getByScope(queryDto: GetItemBatchStockQueryDto): Promise<ItemBatchStockPayload[]>;
    private toPayload;
    private getItemPriceUnitFactors;
    private getUnitFactorForStockUnit;
    private calculateBookQty;
    private toIsoStringOrNull;
    private toNumber;
    private throwItemBatchStockNotFound;
    private throwItemPriceMasterNotFound;
    private buildErrorResponse;
}
