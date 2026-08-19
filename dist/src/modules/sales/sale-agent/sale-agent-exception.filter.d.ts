import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { SaleAgentErrorDetail, SaleAgentErrorResponse } from './types/sale-agent-api.types';
export declare class SaleAgentExceptionFilter extends SalesExceptionFilter<SaleAgentErrorDetail, SaleAgentErrorResponse> {
    constructor();
}
