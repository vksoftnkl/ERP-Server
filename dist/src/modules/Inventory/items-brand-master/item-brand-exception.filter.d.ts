import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemBrandErrorDetail, ItemBrandErrorResponse } from './types/item-brand-api.types';
export declare class ItemBrandExceptionFilter extends InventoryExceptionFilter<ItemBrandErrorDetail, ItemBrandErrorResponse> {
    constructor();
}
