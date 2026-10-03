import { ItemsReorderMasterService } from './items-reorder-master.service';
import { ItemReorderDeleteResult, ItemReorderListItem, ItemReorderListMeta, ItemReorderPayload, ItemReorderSuccessResponse } from './types/item-reorder-api.types';
export declare class ItemsReorderMasterController {
    private readonly itemsReorderMasterService;
    constructor(itemsReorderMasterService: ItemsReorderMasterService);
    save(body: unknown): Promise<ItemReorderSuccessResponse<ItemReorderPayload | ItemReorderPayload[]>>;
    getById(query: Record<string, unknown>): Promise<ItemReorderSuccessResponse<ItemReorderPayload> | ItemReorderSuccessResponse<ItemReorderListItem[], ItemReorderListMeta>>;
    remove(body: unknown, irId?: string): Promise<ItemReorderSuccessResponse<ItemReorderDeleteResult | ItemReorderDeleteResult[]>>;
    private buildToggleDeleteMessage;
    private resolveDeletePayload;
}
