"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEGATIVE_STOCK_MESSAGE_FRAGMENT = exports.STOCK_ENGINE_SQLSTATE_STATUS = exports.STOCK_SRC_MODULE = exports.STOCK_RATE_SOURCES = exports.STOCK_BUCKETS = exports.STOCK_VOUCHER_STATUSES = exports.STOCK_VOUCHER_TYPES = void 0;
exports.STOCK_VOUCHER_TYPES = [
    'OPENING',
    'RECEIPT',
    'ISSUE',
    'ADJUSTMENT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'DAMAGE',
    'EXPIRY_WRITEOFF',
    'PHYSICAL',
    'REPACK_IN',
    'REPACK_OUT',
];
exports.STOCK_VOUCHER_STATUSES = [
    'DRAFT',
    'POSTED',
    'IN_TRANSIT',
    'RECEIVED',
    'CANCELLED',
];
exports.STOCK_BUCKETS = [
    'SALEABLE',
    'DAMAGED',
    'QUARANTINE',
    'EXPIRED',
    'SAMPLE',
];
exports.STOCK_RATE_SOURCES = [
    'AVG_COST',
    'LAST_PURCHASE',
    'LOT_COST',
    'MRP',
    'MANUAL',
];
exports.STOCK_SRC_MODULE = 'STOCK';
exports.STOCK_ENGINE_SQLSTATE_STATUS = {
    P0002: 404,
    '23001': 409,
    '23505': 409,
    '23514': 422,
    '23502': 422,
    '23503': 422,
    '0A000': 409,
};
exports.NEGATIVE_STOCK_MESSAGE_FRAGMENT = 'would go negative';
//# sourceMappingURL=stock-voucher.types.js.map