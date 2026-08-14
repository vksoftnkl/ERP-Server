"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREDIT_ADJUSTMENT_ROUTING = exports.AdjustableCreditStatus = exports.BillSettlementMode = exports.BillAdjType = exports.AdjustableCreditBillType = void 0;
var AdjustableCreditBillType;
(function (AdjustableCreditBillType) {
    AdjustableCreditBillType["ADVANCE"] = "ADVANCE";
    AdjustableCreditBillType["SALES_RETURN"] = "SALES_RETURN";
})(AdjustableCreditBillType || (exports.AdjustableCreditBillType = AdjustableCreditBillType = {}));
var BillAdjType;
(function (BillAdjType) {
    BillAdjType["ADVANCE_ADJUST"] = "ADVANCE_ADJUST";
    BillAdjType["NOTE_ADJUST"] = "NOTE_ADJUST";
})(BillAdjType || (exports.BillAdjType = BillAdjType = {}));
var BillSettlementMode;
(function (BillSettlementMode) {
    BillSettlementMode["ADVANCE"] = "ADVANCE";
    BillSettlementMode["CREDIT_NOTE"] = "CREDIT_NOTE";
})(BillSettlementMode || (exports.BillSettlementMode = BillSettlementMode = {}));
var AdjustableCreditStatus;
(function (AdjustableCreditStatus) {
    AdjustableCreditStatus["OPEN"] = "OPEN";
    AdjustableCreditStatus["PARTIAL"] = "PARTIAL";
})(AdjustableCreditStatus || (exports.AdjustableCreditStatus = AdjustableCreditStatus = {}));
exports.CREDIT_ADJUSTMENT_ROUTING = {
    [AdjustableCreditBillType.ADVANCE]: {
        adjType: BillAdjType.ADVANCE_ADJUST,
        settlementMode: BillSettlementMode.ADVANCE,
    },
    [AdjustableCreditBillType.SALES_RETURN]: {
        adjType: BillAdjType.NOTE_ADJUST,
        settlementMode: BillSettlementMode.CREDIT_NOTE,
    },
};
//# sourceMappingURL=transaction-api.types.js.map