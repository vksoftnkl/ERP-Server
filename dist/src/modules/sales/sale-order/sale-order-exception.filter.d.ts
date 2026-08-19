import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { SaleOrderErrorDetail, SaleOrderErrorResponse } from './types/sale-order-api.types';
export declare class SaleOrderExceptionFilter extends SalesExceptionFilter<SaleOrderErrorDetail, SaleOrderErrorResponse> {
    constructor();
}
