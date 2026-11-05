import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { CustomerGroupErrorDetail, CustomerGroupErrorResponse } from './types/customer-group-api.types';
export declare class CustomerGroupExceptionFilter extends SalesExceptionFilter<CustomerGroupErrorDetail, CustomerGroupErrorResponse> {
    constructor();
}
