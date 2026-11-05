"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAY_SUMMARY_ERROR = exports.TILE_CODES = exports.CHECK_CODES = exports.VOUCHER_NATURES = exports.GROUP_LEVELS = exports.MONEY_KINDS = void 0;
exports.MONEY_KINDS = ['CASH', 'BANK', 'CLEARING'];
exports.GROUP_LEVELS = ['REPORT', 'PRIMARY', 'LEDGER_GROUP'];
exports.VOUCHER_NATURES = [
    'SALES',
    'PURCHASE',
    'RECEIPT',
    'PAYMENT',
    'JOURNAL',
    'CONTRA',
    'DEBIT_NOTE',
    'CREDIT_NOTE',
    'STOCK_JOURNAL',
];
exports.CHECK_CODES = [
    'BALANCED',
    'AMOUNT_TIES',
    'LEGLESS',
    'DRAFTS',
    'CANCELLED_PAIRS',
    'CLEARING_PENDING',
    'BUSINESS_DAY',
    'FUTURE_DATED',
    'NUMBER_GAPS',
];
exports.TILE_CODES = [
    'SALES',
    'SALE_RETURNS',
    'RECEIPTS',
    'PAYMENTS',
    'EXPENSES',
    'CASH_IN_HAND',
];
exports.DAY_SUMMARY_ERROR = {
    BRANCH_NOT_IN_COMPANY: 'BRANCH_NOT_IN_COMPANY',
    YEAR_UNKNOWN: 'YEAR_UNKNOWN',
    RANGE_OUTSIDE_YEAR: 'RANGE_OUTSIDE_YEAR',
    RANGE_REVERSED: 'RANGE_REVERSED',
    TYPE_UNKNOWN: 'TYPE_UNKNOWN',
    GROUP_UNKNOWN: 'GROUP_UNKNOWN',
    CHECK_UNKNOWN: 'CHECK_UNKNOWN',
    RANGE_TOO_LARGE: 'RANGE_TOO_LARGE',
    NO_MENU_RIGHT: 'NO_MENU_RIGHT',
};
//# sourceMappingURL=day-summary.types.js.map