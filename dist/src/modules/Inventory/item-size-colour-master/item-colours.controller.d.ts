import type { InventorySuccessResponse } from "../../../common/types/module-api.types";
import { SaveItemColourDto } from './dto/save-item-colour.dto';
import { ItemColourMasterService } from './item-colour-master.service';
import type { ItemAttributePayload } from './types/item-attribute-master.types';
export declare class ItemColoursController {
    private readonly service;
    constructor(service: ItemColourMasterService);
    save(dto: SaveItemColourDto): Promise<InventorySuccessResponse<ItemAttributePayload>>;
    getById(id: string): Promise<InventorySuccessResponse<ItemAttributePayload>>;
    remove(id: string): Promise<InventorySuccessResponse<ItemAttributePayload>>;
    restore(id: string): Promise<InventorySuccessResponse<ItemAttributePayload>>;
}
