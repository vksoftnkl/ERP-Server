"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargeCostAlloc = exports.ChargeApplyOn = exports.ChargeType = exports.ChargeMethod = exports.ChargeRole = exports.ChargeDocType = void 0;
var ChargeDocType;
(function (ChargeDocType) {
    ChargeDocType["PURCHASE"] = "PURCHASE";
    ChargeDocType["SALES"] = "SALES";
    ChargeDocType["GRN"] = "GRN";
    ChargeDocType["QUOTATION"] = "QUOTATION";
    ChargeDocType["INVOICE"] = "INVOICE";
    ChargeDocType["ORDER"] = "ORDER";
})(ChargeDocType || (exports.ChargeDocType = ChargeDocType = {}));
var ChargeRole;
(function (ChargeRole) {
    ChargeRole["FREIGHT"] = "FREIGHT";
    ChargeRole["LOADING"] = "LOADING";
    ChargeRole["UNLOADING"] = "UNLOADING";
    ChargeRole["CASH_DISC"] = "CASH_DISC";
    ChargeRole["OTHERS"] = "OTHERS";
    ChargeRole["NONE"] = "NONE";
})(ChargeRole || (exports.ChargeRole = ChargeRole = {}));
var ChargeMethod;
(function (ChargeMethod) {
    ChargeMethod["FIXED"] = "FIXED";
    ChargeMethod["QTY"] = "QTY";
    ChargeMethod["NET_QTY"] = "NET_QTY";
    ChargeMethod["KG"] = "KG";
    ChargeMethod["QTL"] = "QTL";
    ChargeMethod["TON"] = "TON";
    ChargeMethod["PERCENT"] = "PERCENT";
})(ChargeMethod || (exports.ChargeMethod = ChargeMethod = {}));
var ChargeType;
(function (ChargeType) {
    ChargeType["ADD"] = "ADD";
    ChargeType["DEDUCT"] = "DEDUCT";
})(ChargeType || (exports.ChargeType = ChargeType = {}));
var ChargeApplyOn;
(function (ChargeApplyOn) {
    ChargeApplyOn["FLAT"] = "FLAT";
    ChargeApplyOn["QTY"] = "QTY";
    ChargeApplyOn["VALUE"] = "VALUE";
    ChargeApplyOn["WEIGHT"] = "WEIGHT";
})(ChargeApplyOn || (exports.ChargeApplyOn = ChargeApplyOn = {}));
var ChargeCostAlloc;
(function (ChargeCostAlloc) {
    ChargeCostAlloc["VALUE"] = "VALUE";
    ChargeCostAlloc["QTY"] = "QTY";
    ChargeCostAlloc["WEIGHT"] = "WEIGHT";
})(ChargeCostAlloc || (exports.ChargeCostAlloc = ChargeCostAlloc = {}));
//# sourceMappingURL=charge-enum.js.map