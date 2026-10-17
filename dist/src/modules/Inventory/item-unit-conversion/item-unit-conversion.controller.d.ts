import { ItemUnitConversionService } from './item-unit-conversion.service';
import { ItemUnitConversionDeleteResult, ItemUnitConversionListItem, ItemUnitConversionListMeta, ItemUnitConversionPayload, ItemUnitConversionSuccessResponse } from './types/item-unit-conversion-api.types';
export declare class ItemUnitConversionController {
    private readonly itemUnitConversionService;
    constructor(itemUnitConversionService: ItemUnitConversionService);
    save(body: unknown): Promise<ItemUnitConversionSuccessResponse<ItemUnitConversionPayload | ItemUnitConversionPayload[]>>;
    getById(query: Record<string, unknown>): Promise<ItemUnitConversionSuccessResponse<ItemUnitConversionPayload> | ItemUnitConversionSuccessResponse<ItemUnitConversionListItem[], ItemUnitConversionListMeta>>;
    remove(body: unknown, query: Record<string, unknown>): Promise<ItemUnitConversionSuccessResponse<ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]>>;
    private resolveDeletePayload;
    private buildSaveSuccessMessage;
    private buildToggleDeleteMessage;
}
