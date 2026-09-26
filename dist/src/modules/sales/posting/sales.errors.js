"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwSalesLocked = throwSalesLocked;
exports.throwSalesRefused = throwSalesRefused;
exports.throwSalesRefusals = throwSalesRefusals;
exports.throwSalesRight = throwSalesRight;
exports.throwSalesInvalid = throwSalesInvalid;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
function throwSalesLocked(message, code, field, detail) {
    (0, module_service_utils_1.throwSalesConflict)(message, [{ field, message, code, ...detail }]);
}
function throwSalesRefused(message, code, field, detail) {
    (0, module_service_utils_1.throwUnprocessable)(message, [{ field, message, code, ...detail }]);
}
function throwSalesRefusals(message, refusals) {
    (0, module_service_utils_1.throwUnprocessable)(message, refusals.map((r) => ({
        field: r.field ?? 'document',
        message: r.message,
        code: r.code,
        ...(r.line === undefined ? {} : { line: r.line }),
        ...(r.statutory === undefined ? {} : { statutory: r.statutory }),
    })));
}
function throwSalesRight(message, code, field = 'userId') {
    (0, module_service_utils_1.throwSalesForbidden)(message, [{ field, message, code }]);
}
function throwSalesInvalid(message, code, field) {
    (0, module_service_utils_1.throwSalesBadRequest)(message, [{ field, message, code }]);
}
//# sourceMappingURL=sales.errors.js.map