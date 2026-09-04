import { GetItemBatchStockQueryDto } from './dto/get-item-batch-stock-query.dto';
import { ItemBatchStockService } from './itemBatchStockService';
import { ItemBatchStockPayload, ItemBatchStockSuccessResponse } from './types/item-batch-stock-api.types';
export declare class ItemBatchStockController {
    private readonly itemBatchStockService;
    constructor(itemBatchStockService: ItemBatchStockService);
    getByScope(queryDto: GetItemBatchStockQueryDto): Promise<ItemBatchStockSuccessResponse<ItemBatchStockPayload[]>>;
}
