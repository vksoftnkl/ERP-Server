"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwTill = throwTill;
exports.tillErrorCodeOf = tillErrorCodeOf;
exports.throwTillBadRequest = throwTillBadRequest;
exports.throwTillNotFound = throwTillNotFound;
const common_1 = require("@nestjs/common");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const till_enum_1 = require("./types/till-enum");
function throwTill(code, message, field, extra = {}) {
    const detail = { field, message, code, ...extra };
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [detail]), till_enum_1.TILL_ERROR_STATUS[code]);
}
function tillErrorCodeOf(error) {
    if (!(error instanceof common_1.HttpException)) {
        return null;
    }
    const body = error.getResponse();
    const code = typeof body === 'object' ? body.errors?.[0]?.code : undefined;
    return code && Object.values(till_enum_1.TillErrorCode).includes(code)
        ? code
        : null;
}
function throwTillBadRequest(code, message, field) {
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [{ field, message, code }]), 400);
}
function throwTillNotFound(code, what, field, id) {
    const message = `${what} ${id} was not found`;
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [{ field, message, code }]), 404);
}
//# sourceMappingURL=till-errors.js.map