import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { BillErrorDetail, BillErrorResponse } from './types/bill-api.types';
export declare class BillExceptionFilter extends SalesExceptionFilter<BillErrorDetail, BillErrorResponse> {
    constructor();
}
