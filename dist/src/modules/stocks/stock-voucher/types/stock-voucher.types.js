"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEGATIVE_STOCK_MESSAGE_FRAGMENT = exports.STOCK_ENGINE_SQLSTATE_STATUS = exports.PHYSICAL_DEFAULT_RATE_SOURCE = exports.PHYSICAL_TXN_TYPES = exports.STOCK_QUANTITY_MODES = exports.STOCK_SRC_MODULE = exports.STOCK_POST_FUNCTIONS = exports.DERIVABLE_RATE_SOURCES = exports.STOCK_RATE_SOURCES = exports.STOCK_BUCKETS = exports.SAVEABLE_STOCK_VOUCHER_STATUSES = exports.STOCK_VOUCHER_STATUSES = exports.STOCK_VOUCHER_TYPES = void 0;
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
exports.SAVEABLE_STOCK_VOUCHER_STATUSES = [
    'DRAFT',
    'POSTED',
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
exports.DERIVABLE_RATE_SOURCES = [
    'AVG_COST',
    'LAST_PURCHASE',
    'LOT_COST',
    'MRP',
];
exports.STOCK_POST_FUNCTIONS = [
    'stock.fn_svh_post',
    'stock.fn_svh_post_transfer',
    'stock.fn_svh_receive_transfer',
];
exports.STOCK_SRC_MODULE = 'STOCK';
exports.STOCK_QUANTITY_MODES = ['QTY', 'COUNT'];
exports.PHYSICAL_TXN_TYPES = ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'];
exports.PHYSICAL_DEFAULT_RATE_SOURCE = 'AVG_COST';
exports.STOCK_ENGINE_SQLSTATE_STATUS = {
    P0002: 404,
    '23001': 409,
    '23505': 409,
    '23P01': 409,
    '23514': 422,
    '23502': 422,
    '23503': 422,
    '0A000': 409,
};
exports.NEGATIVE_STOCK_MESSAGE_FRAGMENT = 'would go negative';
//# sourceMappingURL=stock-voucher.types.js.map