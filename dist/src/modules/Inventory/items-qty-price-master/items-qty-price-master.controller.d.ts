import { ItemsQtyPriceMasterService } from './items-qty-price-master.service';
import { ItemQtyPriceDeleteResult, ItemQtyPriceListItem, ItemQtyPriceListMeta, ItemQtyPricePayload, ItemQtyPriceSuccessResponse } from './types/item-qty-price-api.types';
export declare class ItemsQtyPriceMasterController {
    private readonly itemsQtyPriceMasterService;
    constructor(itemsQtyPriceMasterService: ItemsQtyPriceMasterService);
    save(body: unknown): Promise<ItemQtyPriceSuccessResponse<ItemQtyPricePayload[]>>;
    getById(query: Record<string, unknown>): Promise<ItemQtyPriceSuccessResponse<ItemQtyPricePayload> | ItemQtyPriceSuccessResponse<ItemQtyPriceListItem[], ItemQtyPriceListMeta>>;
    remove(body: unknown, iqpId?: string): Promise<ItemQtyPriceSuccessResponse<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]>>;
    private resolveSavePayload;
    private buildToggleDeleteMessage;
    private resolveDeletePayload;
}
