import { ItemPriceDetailsService } from './item-price-details.service';
import { ItemPriceDetailPayload, ItemPriceDetailSuccessResponse } from './types/item-price-detail-api.types';
export declare class ItemPriceDetailsController {
    private readonly itemPriceDetailsService;
    constructor(itemPriceDetailsService: ItemPriceDetailsService);
    getByItemId(query: Record<string, unknown>): Promise<ItemPriceDetailSuccessResponse<ItemPriceDetailPayload>>;
    getByBarcode(query: Record<string, unknown>): Promise<ItemPriceDetailSuccessResponse<ItemPriceDetailPayload>>;
}
