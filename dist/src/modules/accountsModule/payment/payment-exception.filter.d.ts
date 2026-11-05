import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { PaymentErrorDetail, PaymentErrorResponse } from './types/payment-api.types';
export declare class PaymentExceptionFilter extends AccountsExceptionFilter<PaymentErrorDetail, PaymentErrorResponse> {
    constructor();
}
