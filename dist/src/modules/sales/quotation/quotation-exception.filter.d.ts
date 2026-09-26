import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { QuotationErrorDetail, QuotationErrorResponse } from './types/quotation-api.types';
export declare class QuotationExceptionFilter extends SalesExceptionFilter<QuotationErrorDetail, QuotationErrorResponse> {
    constructor();
}
