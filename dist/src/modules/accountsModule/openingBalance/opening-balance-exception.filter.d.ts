import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { OpeningBalanceErrorDetail, OpeningBalanceErrorResponse } from './types/opening-balance-api.types';
export declare class OpeningBalanceExceptionFilter extends AccountsExceptionFilter<OpeningBalanceErrorDetail, OpeningBalanceErrorResponse> {
    constructor();
}
