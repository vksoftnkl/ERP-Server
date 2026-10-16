import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemGroupErrorDetail, ItemGroupErrorResponse } from './types/item-group-api.types';
export declare class ItemGroupExceptionFilter extends InventoryExceptionFilter<ItemGroupErrorDetail, ItemGroupErrorResponse> {
    constructor();
}
