import { InventoryExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { TaxRateErrorDetail, TaxRateErrorResponse } from './types/tax-rate-api.types';
export declare class TaxRateMasterExceptionFilter extends InventoryExceptionFilter<TaxRateErrorDetail, TaxRateErrorResponse> {
    constructor();
}
