import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemQtyPriceErrorDetail, ItemQtyPriceErrorResponse } from './types/item-qty-price-api.types';
export declare class ItemQtyPriceExceptionFilter extends InventoryExceptionFilter<ItemQtyPriceErrorDetail, ItemQtyPriceErrorResponse> {
    constructor();
}
