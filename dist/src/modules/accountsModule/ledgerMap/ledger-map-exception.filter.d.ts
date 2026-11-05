import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { LedgerMapErrorDetail, LedgerMapErrorResponse } from './types/ledger-map-api.types';
export declare class LedgerMapExceptionFilter extends AccountsExceptionFilter<LedgerMapErrorDetail, LedgerMapErrorResponse> {
    constructor();
}
