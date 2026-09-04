import { PrismaService } from "../../../database/prisma/prisma.service";
import type { ItemPricePayload } from "../../Inventory/items-price-master/types/item-price-api.types";
import { GetItemBatchStockOptionsQueryDto } from './dto/get-item-batch-stock-options-query.dto';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import { GetBulkItemStockListQueryDto } from './dto/get-bulk-item-stock-list-query.dto';
import { BulkItemStockPayload, ItemBatchStockOptionPayload, ItemStockBalancePayload } from './types/item-stock-balance-api.types';
export declare class ItemStockBalanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getByScope(queryDto: GetItemStockBalanceQueryDto): Promise<ItemStockBalancePayload[]>;
    getBulkList(queryDto: GetBulkItemStockListQueryDto): Promise<BulkItemStockPayload[]>;
    getBatchOptionsByScope(queryDto: GetItemBatchStockOptionsQueryDto): Promise<ItemBatchStockOptionPayload[]>;
    getPriceMasterByItemAndUnit(itemId: string, unitId: string): Promise<ItemPricePayload[]>;
    private toPayload;
    private toBatchOptionPayload;
    private toItemPricePayload;
    private getItemPriceUnitFactors;
    private getUnitFactorForStockUnit;
    private calculateBookQty;
    private resolveBatchOptionLimit;
    private toIsoStringOrNull;
    private toNumber;
    private throwItemStockBalanceNotFound;
    private throwItemPriceMasterNotFound;
    private buildErrorResponse;
}
