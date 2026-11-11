"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRequiredException = exports.UPDATE_REQUIRED_STATUS = void 0;
exports.defaultUpdateMessage = defaultUpdateMessage;
const common_1 = require("@nestjs/common");
const app_version_error_codes_1 = require("./app-version-error-codes");
exports.UPDATE_REQUIRED_STATUS = 426;
const PLATFORM_LABEL = {
    web: 'Web',
    desktop: 'Desktop',
    mobile: 'Mobile',
};
function defaultUpdateMessage(platform) {
    return `Please update VK Nex ${PLATFORM_LABEL[platform]} to continue.`;
}
class UpdateRequiredException extends common_1.HttpException {
    constructor(input) {
        const message = input.message?.trim() || defaultUpdateMessage(input.platform);
        const body = {
            success: false,
            statusCode: exports.UPDATE_REQUIRED_STATUS,
            code: app_version_error_codes_1.AppVersionErrorCode.UPDATE_REQUIRED,
            platform: input.platform,
            clientBuild: input.clientBuild,
            expectedBuild: input.expectedBuild,
            message,
            downloadUrl: input.downloadUrl,
            errors: [{ field: 'x-app-build', code: app_version_error_codes_1.AppVersionErrorCode.UPDATE_REQUIRED, message }],
        };
        super(body, exports.UPDATE_REQUIRED_STATUS);
    }
}
exports.UpdateRequiredException = UpdateRequiredException;
//# sourceMappingURL=update-required.exception.js.map