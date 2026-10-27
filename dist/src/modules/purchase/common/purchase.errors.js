"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUR = void 0;
exports.purRefuse = purRefuse;
exports.purRefuseMany = purRefuseMany;
exports.purNotFound = purNotFound;
exports.purConflict = purConflict;
const common_1 = require("@nestjs/common");
exports.PUR = {
    NOT_FOUND: 'PUR_NOT_FOUND',
    SUPPLIER_NOT_FOUND: 'PUR_SUPPLIER_NOT_FOUND',
    ITEM_NOT_FOUND: 'PUR_ITEM_NOT_FOUND',
    UNIT_NOT_FOUND: 'PUR_UNIT_NOT_FOUND',
    CHARGE_NOT_FOUND: 'PUR_CHARGE_NOT_FOUND',
    NO_LINES: 'PUR_NO_LINES',
    QTY_INVALID: 'PUR_QTY_INVALID',
    ALLOC_SUM_MISMATCH: 'PUR_ALLOC_SUM_MISMATCH',
    DUPLICATE_SUPPLIER_INVOICE: 'PUR_DUPLICATE_SUPPLIER_INVOICE',
    INVOICE_AMOUNT_MISMATCH: 'PUR_INVOICE_AMOUNT_MISMATCH',
    NOT_DRAFT: 'PUR_NOT_DRAFT',
    NOT_POSTED: 'PUR_NOT_POSTED',
    EDIT_LOCKED_PAID: 'PUR_EDIT_LOCKED_PAID',
    OFFBILL_NO_PAYEE: 'PUR_OFFBILL_NO_PAYEE',
    OFFBILL_GTA_REFUSED: 'PUR_OFFBILL_GTA_REFUSED',
    MODE_NOT_SUPPORTED: 'PUR_MODE_NOT_SUPPORTED',
    VOUCHER_TYPE_MISSING: 'PUR_VOUCHER_TYPE_MISSING',
    STOCK_QTY_MISMATCH: 'PUR_STOCK_QTY_MISMATCH',
    SERIAL_COUNT: 'PUR_SERIAL_COUNT',
};
function body(message, errors) {
    return { success: false, message, errors };
}
function purRefuse(message, code, field = 'request', status = common_1.HttpStatus.UNPROCESSABLE_ENTITY) {
    throw new common_1.HttpException(body(message, [{ field, code, message }]), status);
}
function purRefuseMany(message, errors, status = common_1.HttpStatus.UNPROCESSABLE_ENTITY) {
    throw new common_1.HttpException(body(message, errors), status);
}
function purNotFound(message, code = exports.PUR.NOT_FOUND, field = 'id') {
    throw new common_1.HttpException(body(message, [{ field, code, message }]), common_1.HttpStatus.NOT_FOUND);
}
function purConflict(message, code, field = 'request') {
    throw new common_1.HttpException(body(message, [{ field, code, message }]), common_1.HttpStatus.CONFLICT);
}
//# sourceMappingURL=purchase.errors.js.map