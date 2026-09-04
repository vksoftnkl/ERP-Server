import { ItemsPriceMasterService } from './items-price-master.service';
import { ItemPriceDeleteResult, ItemPriceListItem, ItemPriceListMeta, ItemPricePayload, ItemPriceSuccessResponse } from './types/item-price-api.types';
export declare class ItemsPriceMasterController {
    private readonly itemsPriceMasterService;
    constructor(itemsPriceMasterService: ItemsPriceMasterService);
    save(body: unknown): Promise<ItemPriceSuccessResponse<ItemPricePayload | ItemPricePayload[]>>;
    getById(query: Record<string, unknown>): Promise<ItemPriceSuccessResponse<ItemPricePayload> | ItemPriceSuccessResponse<ItemPriceListItem[], ItemPriceListMeta>>;
    remove(body: unknown, query: Record<string, unknown>): Promise<ItemPriceSuccessResponse<ItemPriceDeleteResult | ItemPriceDeleteResult[]>>;
    private resolveDeletePayload;
    private buildSaveSuccessMessage;
    private buildToggleDeleteMessage;
}
