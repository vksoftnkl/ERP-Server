import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { VoucherApiErrorDetail, VoucherErrorResponse } from './types/vouchers-api.types';
export declare class VouchersExceptionFilter extends AccountsExceptionFilter<VoucherApiErrorDetail, VoucherErrorResponse> {
    constructor();
}
