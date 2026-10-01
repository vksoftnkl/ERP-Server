import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemErrorDetail, ItemErrorResponse } from './types/item-api.types';
export declare class ItemExceptionFilter extends InventoryExceptionFilter<ItemErrorDetail, ItemErrorResponse> {
    constructor();
}
