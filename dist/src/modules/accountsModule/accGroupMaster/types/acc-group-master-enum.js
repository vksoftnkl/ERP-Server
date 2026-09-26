"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccLedgerProfile = exports.AccGroupMasterNature = exports.AccGroupMasterType = void 0;
var AccGroupMasterType;
(function (AccGroupMasterType) {
    AccGroupMasterType["BALANCE_SHEET"] = "BALANCESHEET";
    AccGroupMasterType["PROFIT_AND_LOSS"] = "PROFITANDLOSS";
})(AccGroupMasterType || (exports.AccGroupMasterType = AccGroupMasterType = {}));
var AccGroupMasterNature;
(function (AccGroupMasterNature) {
    AccGroupMasterNature["ASSETS"] = "Assets";
    AccGroupMasterNature["LIABILITIES"] = "Liabilities";
    AccGroupMasterNature["INCOME"] = "Income";
    AccGroupMasterNature["EXPENSES"] = "Expenses";
})(AccGroupMasterNature || (exports.AccGroupMasterNature = AccGroupMasterNature = {}));
var AccLedgerProfile;
(function (AccLedgerProfile) {
    AccLedgerProfile["GENERAL"] = "General";
    AccLedgerProfile["TAX"] = "Tax";
    AccLedgerProfile["BANK"] = "Bank";
    AccLedgerProfile["PARTY"] = "Party";
    AccLedgerProfile["SALES_PURCHASE"] = "SalesPurchase";
    AccLedgerProfile["CASH"] = "Cash";
})(AccLedgerProfile || (exports.AccLedgerProfile = AccLedgerProfile = {}));
//# sourceMappingURL=acc-group-master-enum.js.map