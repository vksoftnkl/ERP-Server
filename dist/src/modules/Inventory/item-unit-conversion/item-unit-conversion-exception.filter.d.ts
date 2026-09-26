import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemUnitConversionErrorDetail, ItemUnitConversionErrorResponse } from './types/item-unit-conversion-api.types';
export declare class ItemUnitConversionExceptionFilter extends InventoryExceptionFilter<ItemUnitConversionErrorDetail, ItemUnitConversionErrorResponse> {
    constructor();
}
