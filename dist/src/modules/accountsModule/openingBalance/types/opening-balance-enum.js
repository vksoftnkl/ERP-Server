"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpeningStaleReason = exports.FiscalYearStatus = exports.OPENING_BILL_TYPE = exports.OPENING_SRC_DOC_TYPE = exports.OPENING_SRC_MODULE = exports.POSTED_VOUCHER_STATUS = exports.OpeningLedgerRole = exports.PROFIT_AND_LOSS_NATURES = exports.BALANCE_SHEET_NATURES = exports.BillDrCr = exports.OpeningDrCr = exports.OpeningSource = void 0;
var OpeningSource;
(function (OpeningSource) {
    OpeningSource["CARRY_FORWARD"] = "CARRY_FORWARD";
    OpeningSource["MANUAL"] = "MANUAL";
    OpeningSource["MIGRATION"] = "MIGRATION";
})(OpeningSource || (exports.OpeningSource = OpeningSource = {}));
var OpeningDrCr;
(function (OpeningDrCr) {
    OpeningDrCr["DEBIT"] = "D";
    OpeningDrCr["CREDIT"] = "C";
})(OpeningDrCr || (exports.OpeningDrCr = OpeningDrCr = {}));
var BillDrCr;
(function (BillDrCr) {
    BillDrCr["DEBIT"] = "DR";
    BillDrCr["CREDIT"] = "CR";
})(BillDrCr || (exports.BillDrCr = BillDrCr = {}));
exports.BALANCE_SHEET_NATURES = ['Assets', 'Liabilities'];
exports.PROFIT_AND_LOSS_NATURES = ['Income', 'Expenses'];
var OpeningLedgerRole;
(function (OpeningLedgerRole) {
    OpeningLedgerRole["OPENING_DIFFERENCE"] = "OPENING_DIFFERENCE";
    OpeningLedgerRole["RETAINED_EARNINGS"] = "RETAINED_EARNINGS";
})(OpeningLedgerRole || (exports.OpeningLedgerRole = OpeningLedgerRole = {}));
exports.POSTED_VOUCHER_STATUS = 'POSTED';
exports.OPENING_SRC_MODULE = 'ACCOUNTS';
exports.OPENING_SRC_DOC_TYPE = 'OPENING_BALANCE';
exports.OPENING_BILL_TYPE = 'OPENING';
var FiscalYearStatus;
(function (FiscalYearStatus) {
    FiscalYearStatus["OPEN"] = "OPEN";
    FiscalYearStatus["CLOSED"] = "CLOSED";
    FiscalYearStatus["LOCKED"] = "LOCKED";
})(FiscalYearStatus || (exports.FiscalYearStatus = FiscalYearStatus = {}));
var OpeningStaleReason;
(function (OpeningStaleReason) {
    OpeningStaleReason["VOUCHER_POSTED"] = "VOUCHER_POSTED";
    OpeningStaleReason["VOUCHER_CANCELLED"] = "VOUCHER_CANCELLED";
    OpeningStaleReason["SOURCE_OPENING_EDITED"] = "SOURCE_OPENING_EDITED";
    OpeningStaleReason["YEAR_REOPENED"] = "YEAR_REOPENED";
    OpeningStaleReason["MANUAL"] = "MANUAL";
})(OpeningStaleReason || (exports.OpeningStaleReason = OpeningStaleReason = {}));
//# sourceMappingURL=opening-balance-enum.js.map