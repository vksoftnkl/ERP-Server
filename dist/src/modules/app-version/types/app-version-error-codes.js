"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionErrorCode = void 0;
exports.appVersionErrorBody = appVersionErrorBody;
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
var AppVersionErrorCode;
(function (AppVersionErrorCode) {
    AppVersionErrorCode["ADMIN_ONLY"] = "APP_VERSION_ADMIN_ONLY";
    AppVersionErrorCode["PLATFORM_REQUIRED"] = "APP_VERSION_PLATFORM_REQUIRED";
    AppVersionErrorCode["BUILD_REQUIRED"] = "APP_VERSION_BUILD_REQUIRED";
    AppVersionErrorCode["RELEASE_BUILD_EXISTS"] = "APP_RELEASE_BUILD_EXISTS";
    AppVersionErrorCode["RELEASE_BUILD_TOO_LOW"] = "APP_RELEASE_BUILD_TOO_LOW";
    AppVersionErrorCode["RELEASE_NOT_FOUND"] = "APP_RELEASE_NOT_FOUND";
    AppVersionErrorCode["POLICY_BUILD_REQUIRED"] = "APP_POLICY_BUILD_REQUIRED";
    AppVersionErrorCode["POLICY_NO_MANIFEST"] = "APP_POLICY_NO_MANIFEST";
    AppVersionErrorCode["UPDATE_REQUIRED"] = "UPDATE_REQUIRED";
})(AppVersionErrorCode || (exports.AppVersionErrorCode = AppVersionErrorCode = {}));
function appVersionErrorBody(message, field, code) {
    return (0, module_shared_utils_1.buildErrorResponse)(message, [{ field, message, code }]);
}
//# sourceMappingURL=app-version-error-codes.js.map