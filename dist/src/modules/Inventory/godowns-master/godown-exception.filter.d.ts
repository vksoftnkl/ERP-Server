import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { GodownErrorDetail, GodownErrorResponse } from './types/godown-api.types';
export declare class GodownExceptionFilter extends InventoryExceptionFilter<GodownErrorDetail, GodownErrorResponse> {
    constructor();
}
