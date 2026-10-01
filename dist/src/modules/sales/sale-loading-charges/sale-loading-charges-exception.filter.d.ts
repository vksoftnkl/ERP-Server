import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse } from './types/sale-loading-charges-api.types';
export declare class SaleLoadingChargeExceptionFilter extends SalesExceptionFilter<SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse> {
    constructor();
}
