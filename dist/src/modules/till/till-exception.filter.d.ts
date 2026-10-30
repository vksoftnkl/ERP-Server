import { AccountsExceptionFilter } from "../../common/utils/module-exception-filter.utils";
import type { TillErrorDetail, TillErrorResponse } from './types/till-api.types';
export declare class TillExceptionFilter extends AccountsExceptionFilter<TillErrorDetail, TillErrorResponse> {
    constructor();
}
