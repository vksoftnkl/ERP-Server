import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemCategoryErrorDetail, ItemCategoryErrorResponse } from './types/item-category-api.types';
export declare class ItemCategoryExceptionFilter extends InventoryExceptionFilter<ItemCategoryErrorDetail, ItemCategoryErrorResponse> {
    constructor();
}
