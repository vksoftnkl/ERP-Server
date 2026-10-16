import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemGstUnitErrorDetail, ItemGstUnitErrorResponse } from './types/item-gst-unit-api.types';
export declare class ItemGstUnitExceptionFilter extends InventoryExceptionFilter<ItemGstUnitErrorDetail, ItemGstUnitErrorResponse> {
    constructor();
}
