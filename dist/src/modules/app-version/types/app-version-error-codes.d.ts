import { type ModuleErrorDetail, type ModuleErrorResponse } from '../../../common/utils/module-shared.utils';
export declare enum AppVersionErrorCode {
    ADMIN_ONLY = "APP_VERSION_ADMIN_ONLY",
    PLATFORM_REQUIRED = "APP_VERSION_PLATFORM_REQUIRED",
    BUILD_REQUIRED = "APP_VERSION_BUILD_REQUIRED",
    RELEASE_BUILD_EXISTS = "APP_RELEASE_BUILD_EXISTS",
    RELEASE_BUILD_TOO_LOW = "APP_RELEASE_BUILD_TOO_LOW",
    RELEASE_NOT_FOUND = "APP_RELEASE_NOT_FOUND",
    POLICY_BUILD_REQUIRED = "APP_POLICY_BUILD_REQUIRED",
    POLICY_NO_MANIFEST = "APP_POLICY_NO_MANIFEST",
    UPDATE_REQUIRED = "UPDATE_REQUIRED"
}
export interface AppVersionErrorDetail extends ModuleErrorDetail {
    code: AppVersionErrorCode;
}
export declare function appVersionErrorBody(message: string, field: string, code: AppVersionErrorCode): ModuleErrorResponse<AppVersionErrorDetail>;
