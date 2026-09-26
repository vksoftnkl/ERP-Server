import { PurchaseExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { SupplierErrorDetail, SupplierErrorResponse } from './types/supplier-api.types';
export declare class SupplierExceptionFilter extends PurchaseExceptionFilter<SupplierErrorDetail, SupplierErrorResponse> {
    constructor();
}
