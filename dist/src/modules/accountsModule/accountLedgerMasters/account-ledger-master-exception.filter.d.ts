import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { AccountLedgerMasterErrorDetail, AccountLedgerMasterErrorResponse } from './types/account-ledger-master-api.types';
export declare class AccountLedgerMasterExceptionFilter extends AccountsExceptionFilter<AccountLedgerMasterErrorDetail, AccountLedgerMasterErrorResponse> {
    constructor();
}
