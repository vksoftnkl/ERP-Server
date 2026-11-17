"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpStatusOf = httpStatusOf;
exports.raiseNote = raiseNote;
exports.refuseWith = refuseWith;
exports.worded = worded;
exports.note = note;
const common_1 = require("@nestjs/common");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const error_wording_1 = require("../../../common/error-wording/error-wording");
const sales_errors_1 = require("../posting/sales.errors");
const delivery_constants_1 = require("./core/delivery.constants");
const FORBIDDEN = new Set([
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_VIEW,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_CREATE,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_EDIT,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_DELETE,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_POST,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_CANCEL,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_PRINT,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_EXPORT,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_RIGHT,
    delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RIGHT_VIEW,
    delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RIGHT_MODE,
]);
const CONFLICT = new Set([
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_NOT_DRAFT,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_ALREADY_CANCELLED,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_REVISION_STALE,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_LOCKED,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_QTY_OVER_PENDING,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_NOT_POSTED,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_INSTANT,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_OTHER_BRANCH,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_LINE_NOT_GOODS,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_WARN_NOT_CONFIRMED,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_FROZEN,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_STOCK_NEGATIVE,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_GOODS_BACK_OVER,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_GOODS_BACK_NOT_POSTED,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_SCAN_NO_OPEN_HERE,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_UNDO_BELOW_RETURNED,
    delivery_constants_1.DELIVERY_ERROR_CODES.DN_DRAFT_YEAR_CHANGED,
    delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_NOTHING_OPEN,
    delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_MODE_GIVEN,
    delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_MODE_INSTANT,
]);
const NOT_FOUND = new Set([delivery_constants_1.DELIVERY_ERROR_CODES.DN_NOT_FOUND, delivery_constants_1.DELIVERY_ERROR_CODES.DN_SCAN_UNKNOWN]);
function httpStatusOf(code) {
    if (FORBIDDEN.has(code)) {
        return 403;
    }
    if (NOT_FOUND.has(code)) {
        return 404;
    }
    if (CONFLICT.has(code)) {
        return 409;
    }
    return 422;
}
function raiseNote(note) {
    const detail = {
        ...(note.lineNo ? { line: note.lineNo } : {}),
        ...(note.event ? { event: note.event } : {}),
        params: note.params,
    };
    switch (httpStatusOf(note.code)) {
        case 403:
            (0, sales_errors_1.throwSalesRight)(note.message, note.code, note.field);
            break;
        case 404:
            throw new common_1.NotFoundException((0, module_service_utils_1.buildErrorResponse)('Not found', [
                { field: note.field, message: note.message, code: note.code, params: note.params },
            ]));
        case 409:
            (0, sales_errors_1.throwSalesLocked)(note.message, note.code, note.field, detail);
            break;
        default:
            (0, sales_errors_1.throwSalesRefused)(note.message, note.code, note.field, detail);
    }
    throw new Error('unreachable');
}
function refuseWith(code, message, field, params = {}, lineNo, event) {
    return raiseNote({ code, message, field, params, lineNo, event });
}
function worded(note) {
    const user = (0, error_wording_1.wordingFor)({ ...note, line: note.lineNo ?? undefined });
    return user ? { ...note, user } : { ...note };
}
function note(code, severity, field, message, params = {}, lineNo) {
    return { code, severity, field, message, params, lineNo: lineNo ?? null };
}
//# sourceMappingURL=delivery.errors.js.map