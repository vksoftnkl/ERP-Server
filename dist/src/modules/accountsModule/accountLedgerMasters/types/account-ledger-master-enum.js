"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankAccountType = exports.LedObType = exports.LedGstPartyRegType = void 0;
var LedGstPartyRegType;
(function (LedGstPartyRegType) {
    LedGstPartyRegType["REGULAR"] = "REGULAR";
    LedGstPartyRegType["COMPOSITION"] = "COMPOSITION";
    LedGstPartyRegType["UNREGISTERED"] = "UNREGISTERED";
})(LedGstPartyRegType || (exports.LedGstPartyRegType = LedGstPartyRegType = {}));
var LedObType;
(function (LedObType) {
    LedObType["DR"] = "DR";
    LedObType["CR"] = "CR";
})(LedObType || (exports.LedObType = LedObType = {}));
var BankAccountType;
(function (BankAccountType) {
    BankAccountType["SAVINGS"] = "SAVINGS";
    BankAccountType["CURRENT"] = "CURRENT";
    BankAccountType["CASH_CREDIT"] = "CASH_CREDIT";
    BankAccountType["OVERDRAFT"] = "OVERDRAFT";
})(BankAccountType || (exports.BankAccountType = BankAccountType = {}));
//# sourceMappingURL=account-ledger-master-enum.js.map