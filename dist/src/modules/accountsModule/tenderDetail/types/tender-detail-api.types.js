"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENDER_DETAIL_VALUE_GUARDS = exports.TENDER_SETTLE_STATUSES = exports.TENDER_DR_CRS = exports.TENDER_SRC_DOC_TYPES = exports.TENDER_SRC_MODULES = exports.TenderSettleStatus = exports.TenderDrCr = exports.TenderSrcDocType = exports.TenderSrcModule = void 0;
var TenderSrcModule;
(function (TenderSrcModule) {
    TenderSrcModule["SALES"] = "SALES";
    TenderSrcModule["ACCOUNTS"] = "ACCOUNTS";
    TenderSrcModule["POS"] = "POS";
    TenderSrcModule["SERVICE"] = "SERVICE";
    TenderSrcModule["OTHER"] = "OTHER";
})(TenderSrcModule || (exports.TenderSrcModule = TenderSrcModule = {}));
var TenderSrcDocType;
(function (TenderSrcDocType) {
    TenderSrcDocType["SALES_ORDER"] = "SALES_ORDER";
    TenderSrcDocType["SALE_BILL"] = "SALE_BILL";
    TenderSrcDocType["SALE_RETURN"] = "SALE_RETURN";
    TenderSrcDocType["RECEIPT"] = "RECEIPT";
    TenderSrcDocType["PAYMENT"] = "PAYMENT";
    TenderSrcDocType["OTHER"] = "OTHER";
})(TenderSrcDocType || (exports.TenderSrcDocType = TenderSrcDocType = {}));
var TenderDrCr;
(function (TenderDrCr) {
    TenderDrCr["DR"] = "DR";
    TenderDrCr["CR"] = "CR";
})(TenderDrCr || (exports.TenderDrCr = TenderDrCr = {}));
var TenderSettleStatus;
(function (TenderSettleStatus) {
    TenderSettleStatus["NA"] = "NA";
    TenderSettleStatus["PENDING"] = "PENDING";
    TenderSettleStatus["SETTLED"] = "SETTLED";
    TenderSettleStatus["PARTIAL"] = "PARTIAL";
    TenderSettleStatus["FAILED"] = "FAILED";
})(TenderSettleStatus || (exports.TenderSettleStatus = TenderSettleStatus = {}));
exports.TENDER_SRC_MODULES = Object.values(TenderSrcModule);
exports.TENDER_SRC_DOC_TYPES = Object.values(TenderSrcDocType);
exports.TENDER_DR_CRS = Object.values(TenderDrCr);
exports.TENDER_SETTLE_STATUSES = Object.values(TenderSettleStatus);
exports.TENDER_DETAIL_VALUE_GUARDS = [
    { field: 'tdSrcModule', allowed: exports.TENDER_SRC_MODULES, nullable: false },
    { field: 'tdSrcDocType', allowed: exports.TENDER_SRC_DOC_TYPES, nullable: false },
    { field: 'tdDrCr', allowed: exports.TENDER_DR_CRS, nullable: false },
    { field: 'tdSettleStatus', allowed: exports.TENDER_SETTLE_STATUSES, nullable: false },
];
//# sourceMappingURL=tender-detail-api.types.js.map