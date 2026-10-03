import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { LedgerBankAccountErrorDetail, LedgerBankAccountErrorResponse } from './types/ledger-bank-account-api.types';
export declare class LedgerBankAccountExceptionFilter extends AccountsExceptionFilter<LedgerBankAccountErrorDetail, LedgerBankAccountErrorResponse> {
    constructor();
}
