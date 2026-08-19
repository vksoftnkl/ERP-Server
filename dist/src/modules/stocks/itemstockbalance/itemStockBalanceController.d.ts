import { GetItemBatchStockOptionsQueryDto } from './dto/get-item-batch-stock-options-query.dto';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import { GetBulkItemStockListQueryDto } from './dto/get-bulk-item-stock-list-query.dto';
import { ItemStockBalanceService } from './itemstockBalanceService';
import { BulkItemStockPayload, ItemBatchStockOptionPayload, ItemStockBalancePayload, ItemStockBalanceSuccessResponse } from './types/item-stock-balance-api.types';
export declare class ItemStockBalanceController {
    private readonly itemStockBalanceService;
    constructor(itemStockBalanceService: ItemStockBalanceService);
    getByScope(queryDto: GetItemStockBalanceQueryDto): Promise<ItemStockBalanceSuccessResponse<ItemStockBalancePayload[]>>;
    getBulkList(queryDto: GetBulkItemStockListQueryDto): Promise<ItemStockBalanceSuccessResponse<BulkItemStockPayload[]>>;
    getBatchOptionsByScope(queryDto: GetItemBatchStockOptionsQueryDto): Promise<ItemStockBalanceSuccessResponse<ItemBatchStockOptionPayload[]>>;
}
