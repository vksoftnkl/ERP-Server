import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { ReceiptErrorDetail, ReceiptErrorResponse } from './types/receipt-api.types';
export declare class ReceiptExceptionFilter extends AccountsExceptionFilter<ReceiptErrorDetail, ReceiptErrorResponse> {
    constructor();
}
