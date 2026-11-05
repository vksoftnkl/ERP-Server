"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankAccountType = exports.LedItcEligibility = exports.LedTypeOfSupply = exports.LedRoundingMethod = exports.LedMsmeType = exports.LedGstDutyHead = exports.LedLedgerType = exports.LedObType = exports.LedGstPartyRegType = void 0;
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
var LedLedgerType;
(function (LedLedgerType) {
    LedLedgerType["PARTY"] = "PARTY";
    LedLedgerType["BANK"] = "BANK";
    LedLedgerType["CASH"] = "CASH";
    LedLedgerType["TAX"] = "TAX";
    LedLedgerType["ROUNDOFF"] = "ROUNDOFF";
    LedLedgerType["DISCOUNT"] = "DISCOUNT";
    LedLedgerType["EXPENSE"] = "EXPENSE";
    LedLedgerType["INCOME"] = "INCOME";
    LedLedgerType["GENERAL"] = "GENERAL";
})(LedLedgerType || (exports.LedLedgerType = LedLedgerType = {}));
var LedGstDutyHead;
(function (LedGstDutyHead) {
    LedGstDutyHead["CENTRAL_TAX"] = "Central Tax";
    LedGstDutyHead["STATE_TAX"] = "State Tax";
    LedGstDutyHead["INTEGRATED_TAX"] = "Integrated Tax";
    LedGstDutyHead["CESS"] = "Cess";
    LedGstDutyHead["STATE_CESS"] = "State Cess";
})(LedGstDutyHead || (exports.LedGstDutyHead = LedGstDutyHead = {}));
var LedMsmeType;
(function (LedMsmeType) {
    LedMsmeType["MICRO"] = "Micro";
    LedMsmeType["SMALL"] = "Small";
    LedMsmeType["MEDIUM"] = "Medium";
})(LedMsmeType || (exports.LedMsmeType = LedMsmeType = {}));
var LedRoundingMethod;
(function (LedRoundingMethod) {
    LedRoundingMethod["NOT_APPLICABLE"] = "Not Applicable";
    LedRoundingMethod["UPWARD"] = "Upward";
    LedRoundingMethod["DOWNWARD"] = "Downward";
    LedRoundingMethod["NORMAL"] = "Normal";
})(LedRoundingMethod || (exports.LedRoundingMethod = LedRoundingMethod = {}));
var LedTypeOfSupply;
(function (LedTypeOfSupply) {
    LedTypeOfSupply["GOODS"] = "Goods";
    LedTypeOfSupply["SERVICES"] = "Services";
})(LedTypeOfSupply || (exports.LedTypeOfSupply = LedTypeOfSupply = {}));
var LedItcEligibility;
(function (LedItcEligibility) {
    LedItcEligibility["ELIGIBLE"] = "ELIGIBLE";
    LedItcEligibility["INELIGIBLE_17_5"] = "INELIGIBLE_17_5";
    LedItcEligibility["INELIGIBLE_OTHER"] = "INELIGIBLE_OTHER";
    LedItcEligibility["CAPITAL_GOODS"] = "CAPITAL_GOODS";
    LedItcEligibility["INPUT_SERVICES"] = "INPUT_SERVICES";
})(LedItcEligibility || (exports.LedItcEligibility = LedItcEligibility = {}));
var BankAccountType;
(function (BankAccountType) {
    BankAccountType["SAVINGS"] = "SAVINGS";
    BankAccountType["CURRENT"] = "CURRENT";
    BankAccountType["CASH_CREDIT"] = "CASH_CREDIT";
    BankAccountType["OVERDRAFT"] = "OVERDRAFT";
})(BankAccountType || (exports.BankAccountType = BankAccountType = {}));
//# sourceMappingURL=account-ledger-master-enum.js.map