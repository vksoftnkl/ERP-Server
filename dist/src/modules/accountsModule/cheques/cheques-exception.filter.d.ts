import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { ChequeErrorDetail, ChequeErrorResponse } from './types/cheque-api.types';
export declare class ChequesExceptionFilter extends AccountsExceptionFilter<ChequeErrorDetail, ChequeErrorResponse> {
    constructor();
}
