"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthErrorCode = void 0;
exports.authErrorBody = authErrorBody;
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
var AuthErrorCode;
(function (AuthErrorCode) {
    AuthErrorCode["INVALID_CREDENTIALS"] = "AUTH_INVALID_CREDENTIALS";
    AuthErrorCode["USER_INACTIVE"] = "AUTH_USER_INACTIVE";
    AuthErrorCode["AUTHORIZATION_MISSING"] = "AUTH_AUTHORIZATION_MISSING";
    AuthErrorCode["ACCESS_TOKEN_INVALID"] = "AUTH_ACCESS_TOKEN_INVALID";
    AuthErrorCode["ACCESS_TOKEN_EXPIRED"] = "AUTH_ACCESS_TOKEN_EXPIRED";
    AuthErrorCode["REFRESH_TOKEN_INVALID"] = "AUTH_REFRESH_TOKEN_INVALID";
    AuthErrorCode["REFRESH_TOKEN_EXPIRED"] = "AUTH_REFRESH_TOKEN_EXPIRED";
    AuthErrorCode["ACCESS_SESSION_ENDED"] = "AUTH_ACCESS_SESSION_ENDED";
    AuthErrorCode["ACCESS_SESSION_INVALID"] = "AUTH_ACCESS_SESSION_INVALID";
    AuthErrorCode["REFRESH_SESSION_ENDED"] = "AUTH_REFRESH_SESSION_ENDED";
    AuthErrorCode["REFRESH_SESSION_INVALID"] = "AUTH_REFRESH_SESSION_INVALID";
    AuthErrorCode["JWT_SECRET_MISSING"] = "AUTH_JWT_SECRET_MISSING";
    AuthErrorCode["DEVICE_NOT_REGISTERED"] = "AUTH_DEVICE_NOT_REGISTERED";
    AuthErrorCode["DEVICE_BLOCKED"] = "AUTH_DEVICE_BLOCKED";
    AuthErrorCode["DEVICE_UNAVAILABLE"] = "AUTH_DEVICE_UNAVAILABLE";
})(AuthErrorCode || (exports.AuthErrorCode = AuthErrorCode = {}));
function authErrorBody(message, field, code) {
    return (0, module_shared_utils_1.buildErrorResponse)(message, [{ field, message, code }]);
}
//# sourceMappingURL=auth-error-codes.js.map