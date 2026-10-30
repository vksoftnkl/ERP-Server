import type { InventorySuccessResponse } from "../../../common/types/module-api.types";
import { SaveItemSizeDto } from './dto/save-item-size.dto';
import { ItemSizeMasterService } from './item-size-master.service';
import type { ItemAttributePayload } from './types/item-attribute-master.types';
export declare class ItemSizesController {
    private readonly service;
    constructor(service: ItemSizeMasterService);
    save(dto: SaveItemSizeDto): Promise<InventorySuccessResponse<ItemAttributePayload>>;
    getById(id: string): Promise<InventorySuccessResponse<ItemAttributePayload>>;
    remove(id: string): Promise<InventorySuccessResponse<ItemAttributePayload>>;
    restore(id: string): Promise<InventorySuccessResponse<ItemAttributePayload>>;
}
