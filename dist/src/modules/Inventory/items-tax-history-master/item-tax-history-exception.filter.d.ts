import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemTaxHistoryErrorDetail, ItemTaxHistoryErrorResponse } from './types/item-tax-history-api.types';
export declare class ItemTaxHistoryExceptionFilter extends InventoryExceptionFilter<ItemTaxHistoryErrorDetail, ItemTaxHistoryErrorResponse> {
    constructor();
}
