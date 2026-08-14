import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse } from './types/sale-freight-charges-api.types';
export declare class SaleFreightChargeExceptionFilter extends SalesExceptionFilter<SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse> {
    constructor();
}
