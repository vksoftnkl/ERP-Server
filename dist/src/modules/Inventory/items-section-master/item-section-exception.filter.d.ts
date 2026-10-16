import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemSectionErrorDetail, ItemSectionErrorResponse } from './types/item-section-api.types';
export declare class ItemSectionExceptionFilter extends InventoryExceptionFilter<ItemSectionErrorDetail, ItemSectionErrorResponse> {
    constructor();
}
