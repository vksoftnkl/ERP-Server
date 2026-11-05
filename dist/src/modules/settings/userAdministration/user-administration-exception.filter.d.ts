import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { UserAdminErrorDetail, UserAdminErrorResponse } from './types/user-administration-api.types';
export declare class UserAdministrationExceptionFilter extends SettingsExceptionFilter<UserAdminErrorDetail, UserAdminErrorResponse> {
    constructor();
}
