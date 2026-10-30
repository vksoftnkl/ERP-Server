import type { ModuleErrorDetail } from '../../../common/utils/module-shared.utils';
export declare enum UsersErrorCode {
    LOGIN_NAME_TAKEN = "USERS_LOGIN_NAME_TAKEN",
    NOT_FOUND = "USERS_NOT_FOUND"
}
export interface UsersErrorDetail extends ModuleErrorDetail {
    code: UsersErrorCode;
}
