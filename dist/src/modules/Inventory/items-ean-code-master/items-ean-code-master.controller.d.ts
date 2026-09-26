import { ItemsEanCodeMasterService } from './items-ean-code-master.service';
import { ItemEanCodeDeleteResult, ItemEanCodeListItem, ItemEanCodeListMeta, ItemEanCodePayload, ItemEanCodeSuccessResponse } from './types/item-ean-code-api.types';
export declare class ItemsEanCodeMasterController {
    private readonly itemsEanCodeMasterService;
    constructor(itemsEanCodeMasterService: ItemsEanCodeMasterService);
    save(body: unknown): Promise<ItemEanCodeSuccessResponse<ItemEanCodePayload | ItemEanCodePayload[]>>;
    getById(query: Record<string, unknown>): Promise<ItemEanCodeSuccessResponse<ItemEanCodePayload> | ItemEanCodeSuccessResponse<ItemEanCodeListItem[], ItemEanCodeListMeta>>;
    remove(body: unknown, eanId?: string): Promise<ItemEanCodeSuccessResponse<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]>>;
    private buildToggleDeleteMessage;
    private resolveDeletePayload;
}
