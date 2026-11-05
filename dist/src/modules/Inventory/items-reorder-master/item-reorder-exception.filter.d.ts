import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemReorderErrorDetail, ItemReorderErrorResponse } from './types/item-reorder-api.types';
export declare class ItemReorderExceptionFilter extends InventoryExceptionFilter<ItemReorderErrorDetail, ItemReorderErrorResponse> {
    constructor();
}
