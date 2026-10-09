"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwTill = throwTill;
exports.throwTillBadRequest = throwTillBadRequest;
exports.throwTillNotFound = throwTillNotFound;
const common_1 = require("@nestjs/common");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const till_enum_1 = require("./types/till-enum");
function throwTill(code, message, field, extra = {}) {
    const detail = { field, message, code, ...extra };
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [detail]), till_enum_1.TILL_ERROR_STATUS[code]);
}
function throwTillBadRequest(message, field) {
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [{ field, message }]), 400);
}
function throwTillNotFound(what, field, id) {
    const message = `${what} ${id} was not found`;
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [{ field, message }]), 404);
}
//# sourceMappingURL=till-errors.js.map