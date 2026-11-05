import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemPriceErrorDetail, ItemPriceErrorResponse } from './types/item-price-api.types';
export declare class ItemPriceExceptionFilter extends InventoryExceptionFilter<ItemPriceErrorDetail, ItemPriceErrorResponse> {
    constructor();
}
