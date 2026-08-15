import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemTaxErrorDetail, ItemTaxErrorResponse } from './types/item-tax-api.types';
export declare class ItemTaxExceptionFilter extends InventoryExceptionFilter<ItemTaxErrorDetail, ItemTaxErrorResponse> {
    constructor();
}
