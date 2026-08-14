import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { AccountGroupErrorDetail, AccountGroupErrorResponse } from './types/account-group-api.types';
export declare class AccountGroupExceptionFilter extends AccountsExceptionFilter<AccountGroupErrorDetail, AccountGroupErrorResponse> {
    constructor();
}
