import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ItemEanCodeErrorDetail, ItemEanCodeErrorResponse } from './types/item-ean-code-api.types';
export declare class ItemEanCodeExceptionFilter extends InventoryExceptionFilter<ItemEanCodeErrorDetail, ItemEanCodeErrorResponse> {
    constructor();
}
