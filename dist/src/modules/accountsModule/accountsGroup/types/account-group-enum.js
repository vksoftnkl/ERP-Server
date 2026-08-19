"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccLedgerProfile = exports.AccountGroupNature = exports.AccountGroupType = void 0;
var AccountGroupType;
(function (AccountGroupType) {
    AccountGroupType["BALANCE_SHEET"] = "BALANCESHEET";
    AccountGroupType["PROFIT_AND_LOSS"] = "PROFITANDLOSS";
})(AccountGroupType || (exports.AccountGroupType = AccountGroupType = {}));
var AccountGroupNature;
(function (AccountGroupNature) {
    AccountGroupNature["ASSETS"] = "Assets";
    AccountGroupNature["LIABILITIES"] = "Liabilities";
    AccountGroupNature["INCOME"] = "Income";
    AccountGroupNature["EXPENSES"] = "Expenses";
})(AccountGroupNature || (exports.AccountGroupNature = AccountGroupNature = {}));
var AccLedgerProfile;
(function (AccLedgerProfile) {
    AccLedgerProfile["GENERAL"] = "General";
    AccLedgerProfile["TAX"] = "Tax";
    AccLedgerProfile["BANK"] = "Bank";
    AccLedgerProfile["PARTY"] = "Party";
    AccLedgerProfile["SALES_PURCHASE"] = "SalesPurchase";
    AccLedgerProfile["CASH"] = "Cash";
})(AccLedgerProfile || (exports.AccLedgerProfile = AccLedgerProfile = {}));
//# sourceMappingURL=account-group-enum.js.map