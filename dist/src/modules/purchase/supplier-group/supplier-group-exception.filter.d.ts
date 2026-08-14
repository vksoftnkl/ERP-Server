import { PurchaseExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { SupplierGroupErrorDetail, SupplierGroupErrorResponse } from './types/supplier-group-api.types';
export declare class SupplierGroupExceptionFilter extends PurchaseExceptionFilter<SupplierGroupErrorDetail, SupplierGroupErrorResponse> {
    constructor();
}
