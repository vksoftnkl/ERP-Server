import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { UnitErrorDetail, UnitErrorResponse } from './types/unit-api.types';
export declare class UnitExceptionFilter extends InventoryExceptionFilter<UnitErrorDetail, UnitErrorResponse> {
    constructor();
}
