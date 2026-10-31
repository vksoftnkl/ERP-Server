import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { VoucherApiErrorDetail, VoucherErrorResponse } from '../vouchers/types/vouchers-api.types';
export declare class IssuedChequesExceptionFilter extends AccountsExceptionFilter<VoucherApiErrorDetail, VoucherErrorResponse> {
    constructor();
}
