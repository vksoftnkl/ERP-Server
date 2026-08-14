import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { AreaErrorDetail, AreaErrorResponse } from './types/area-api.types';
export declare class AreaExceptionFilter extends SalesExceptionFilter<AreaErrorDetail, AreaErrorResponse> {
    constructor();
}
