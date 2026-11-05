"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENDER_DETAIL_VALUE_GUARDS = exports.TENDER_SETTLE_STATUSES = exports.TENDER_DR_CRS = exports.TENDER_SRC_DOC_TYPES = exports.TENDER_SRC_MODULES = exports.TenderSettleStatus = exports.TenderDrCr = exports.TenderSrcDocType = exports.TenderSrcModule = exports.TenderDetailErrorCode = void 0;
var TenderDetailErrorCode;
(function (TenderDetailErrorCode) {
    TenderDetailErrorCode["NOT_FOUND"] = "TENDER_LINE_NOT_FOUND";
    TenderDetailErrorCode["LOOKUP_AMBIGUOUS"] = "TENDER_LINE_LOOKUP_AMBIGUOUS";
    TenderDetailErrorCode["LOOKUP_MISSING"] = "TENDER_LINE_LOOKUP_MISSING";
    TenderDetailErrorCode["ROW_NO_DUPLICATE"] = "TENDER_LINE_ROW_NO_DUPLICATE";
    TenderDetailErrorCode["DOCUMENT_IMMUTABLE"] = "TENDER_LINE_DOCUMENT_IMMUTABLE";
    TenderDetailErrorCode["DOCUMENT_MISMATCH"] = "TENDER_LINE_DOCUMENT_MISMATCH";
    TenderDetailErrorCode["TENDER_NOT_FOUND"] = "TENDER_LINE_TENDER_NOT_FOUND";
    TenderDetailErrorCode["TENDER_TYPE_NOT_FOUND"] = "TENDER_LINE_TENDER_TYPE_NOT_FOUND";
    TenderDetailErrorCode["LEDGER_NOT_FOUND"] = "TENDER_LINE_LEDGER_NOT_FOUND";
    TenderDetailErrorCode["REFERENCE_INVALID"] = "TENDER_LINE_REFERENCE_INVALID";
    TenderDetailErrorCode["TOTAL_MISMATCH"] = "TENDER_LINE_TOTAL_MISMATCH";
    TenderDetailErrorCode["VALUE_REQUIRED"] = "TENDER_LINE_VALUE_REQUIRED";
    TenderDetailErrorCode["VALUE_NOT_ALLOWED"] = "TENDER_LINE_VALUE_NOT_ALLOWED";
    TenderDetailErrorCode["CHANGE_EXCEEDS_RECEIVED"] = "TENDER_LINE_CHANGE_EXCEEDS_RECEIVED";
    TenderDetailErrorCode["CONVERSION_RATE_INVALID"] = "TENDER_LINE_CONVERSION_RATE_INVALID";
    TenderDetailErrorCode["SETTLED_ON_REQUIRED"] = "TENDER_LINE_SETTLED_ON_REQUIRED";
    TenderDetailErrorCode["INSTRUMENT_DATE_REQUIRED"] = "TENDER_LINE_INSTRUMENT_DATE_REQUIRED";
    TenderDetailErrorCode["CARD_LAST4_INVALID"] = "TENDER_LINE_CARD_LAST4_INVALID";
    TenderDetailErrorCode["DATE_INVALID"] = "TENDER_LINE_DATE_INVALID";
    TenderDetailErrorCode["NUMBER_INVALID"] = "TENDER_LINE_NUMBER_INVALID";
    TenderDetailErrorCode["TENDER_TYPE_INVALID"] = "TENDER_LINE_TENDER_TYPE_INVALID";
    TenderDetailErrorCode["FIELD_REQUIRED"] = "TENDER_LINE_FIELD_REQUIRED";
})(TenderDetailErrorCode || (exports.TenderDetailErrorCode = TenderDetailErrorCode = {}));
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
    TenderSrcDocType["EXPENSE"] = "EXPENSE";
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