import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { CustomerErrorDetail, CustomerErrorResponse } from './types/customer-api.types';
export declare class CustomerExceptionFilter extends SalesExceptionFilter<CustomerErrorDetail, CustomerErrorResponse> {
    constructor();
}
