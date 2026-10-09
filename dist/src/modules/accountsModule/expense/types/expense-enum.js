"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseMoneyFrom = exports.ExpenseStatus = exports.ExpenseErrorCode = exports.EXPENSE_TENDERS_MAX = exports.EXPENSE_LINES_MAX = exports.EXPENSE_GST_BILL_ABOVE_KEY = exports.EXPENSE_REASON_CATEGORY = exports.EXPENSE_GROUP_NATURE = exports.EXPENSE_SRC_DOC_TYPE = exports.EXPENSE_RIGHT_PREFIX = exports.EXPENSE_LIST_GRID_NAME = exports.EXPENSE_PRINT_PURPOSE_CODE = exports.EXPENSE_VOUCHER_TYPE_CODE = exports.EXPENSE_MENU_ID = void 0;
exports.EXPENSE_MENU_ID = 277;
exports.EXPENSE_VOUCHER_TYPE_CODE = 'ExpV';
exports.EXPENSE_PRINT_PURPOSE_CODE = 'EXPENSE_VOUCHER';
exports.EXPENSE_LIST_GRID_NAME = 'MAIN LIST - EXPENSE VOUCHERS';
exports.EXPENSE_RIGHT_PREFIX = 'EXP';
exports.EXPENSE_SRC_DOC_TYPE = 'EXPENSE';
exports.EXPENSE_GROUP_NATURE = 'Expenses';
exports.EXPENSE_REASON_CATEGORY = 'EXPENSE';
exports.EXPENSE_GST_BILL_ABOVE_KEY = 'accounts.expense_gst_bill_above';
exports.EXPENSE_LINES_MAX = 50;
exports.EXPENSE_TENDERS_MAX = 10;
var ExpenseErrorCode;
(function (ExpenseErrorCode) {
    ExpenseErrorCode["TOTAL_MISMATCH"] = "EXPENSE_TOTAL_MISMATCH";
    ExpenseErrorCode["LEDGER_NOT_EXPENSE"] = "EXPENSE_LEDGER_NOT_EXPENSE";
    ExpenseErrorCode["PARTY_INVALID"] = "EXPENSE_PARTY_INVALID";
    ExpenseErrorCode["GST_INCOMPLETE"] = "EXPENSE_GST_INCOMPLETE";
    ExpenseErrorCode["GST_RATE_MISSING"] = "EXPENSE_GST_RATE_MISSING";
    ExpenseErrorCode["GST_LEDGER_UNMAPPED"] = "EXPENSE_GST_LEDGER_UNMAPPED";
    ExpenseErrorCode["GST_BILL_MISSING"] = "EXPENSE_GST_BILL_MISSING";
    ExpenseErrorCode["TENDER_NOT_ALLOWED"] = "EXPENSE_TENDER_NOT_ALLOWED";
    ExpenseErrorCode["NO_LINES"] = "EXPENSE_NO_LINES";
})(ExpenseErrorCode || (exports.ExpenseErrorCode = ExpenseErrorCode = {}));
var ExpenseStatus;
(function (ExpenseStatus) {
    ExpenseStatus["DRAFT"] = "DRAFT";
    ExpenseStatus["POSTED"] = "POSTED";
    ExpenseStatus["CANCELLED"] = "CANCELLED";
})(ExpenseStatus || (exports.ExpenseStatus = ExpenseStatus = {}));
var ExpenseMoneyFrom;
(function (ExpenseMoneyFrom) {
    ExpenseMoneyFrom["DRAWER"] = "DRAWER";
    ExpenseMoneyFrom["SAFE"] = "SAFE";
    ExpenseMoneyFrom["LEDGER"] = "LEDGER";
})(ExpenseMoneyFrom || (exports.ExpenseMoneyFrom = ExpenseMoneyFrom = {}));
//# sourceMappingURL=expense-enum.js.map