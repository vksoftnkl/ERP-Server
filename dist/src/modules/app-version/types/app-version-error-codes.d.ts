import { type ModuleErrorDetail, type ModuleErrorResponse } from '../../../common/utils/module-shared.utils';
export declare enum AppVersionErrorCode {
    OPS_DISABLED = "APP_VERSION_OPS_DISABLED",
    OPS_KEY_INVALID = "APP_VERSION_OPS_KEY_INVALID",
    PLATFORM_REQUIRED = "APP_VERSION_PLATFORM_REQUIRED",
    BUILD_REQUIRED = "APP_VERSION_BUILD_REQUIRED",
    RELEASE_BUILD_EXISTS = "APP_RELEASE_BUILD_EXISTS",
    RELEASE_BUILD_TOO_LOW = "APP_RELEASE_BUILD_TOO_LOW",
    RELEASE_NOT_FOUND = "APP_RELEASE_NOT_FOUND"
}
export interface AppVersionErrorDetail extends ModuleErrorDetail {
    code: AppVersionErrorCode;
}
export declare function appVersionErrorBody(message: string, field: string, code: AppVersionErrorCode): ModuleErrorResponse<AppVersionErrorDetail>;
