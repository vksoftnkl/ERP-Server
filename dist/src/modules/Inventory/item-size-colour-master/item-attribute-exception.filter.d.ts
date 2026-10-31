import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { InventoryErrorResponse } from "../../../common/types/module-api.types";
import type { ItemAttributeErrorDetail } from './types/item-attribute-master.types';
export declare class ItemAttributeExceptionFilter extends InventoryExceptionFilter<ItemAttributeErrorDetail, InventoryErrorResponse<ItemAttributeErrorDetail>> {
    constructor();
}
