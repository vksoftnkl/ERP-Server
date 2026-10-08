import { FixedExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse } from './types/user-login-sessions-api.types';
export declare class UserLoginSessionsExceptionFilter extends FixedExceptionFilter<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse> {
    constructor();
}
