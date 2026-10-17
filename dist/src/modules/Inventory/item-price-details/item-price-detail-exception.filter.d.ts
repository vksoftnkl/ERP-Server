import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemPriceDetailErrorDetail, ItemPriceDetailErrorResponse } from './types/item-price-detail-api.types';
export declare class ItemPriceDetailExceptionFilter extends InventoryExceptionFilter<ItemPriceDetailErrorDetail, ItemPriceDetailErrorResponse> {
    constructor();
}
