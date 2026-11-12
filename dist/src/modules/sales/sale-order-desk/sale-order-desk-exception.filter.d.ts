import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { SaleOrderErrorDetail, SaleOrderErrorResponse } from '../sale-order/types/sale-order-api.types';
export declare class SaleOrderDeskExceptionFilter extends SalesExceptionFilter<SaleOrderErrorDetail, SaleOrderErrorResponse> {
    constructor();
}
