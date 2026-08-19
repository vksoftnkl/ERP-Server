"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT = exports.TXN_HOLD_LOCK_TTL_SECONDS_MAX = exports.TXN_HOLD_LOCK_TTL_SECONDS_MIN = exports.TXN_HOLD_VALUE_GUARDS = exports.TXN_HOLD_EXPIRABLE_STATUSES = exports.TXN_HOLD_IN_USE_STATUSES = exports.TXN_HOLD_CLOSED_STATUSES = exports.TXN_HOLD_PARTY_TYPES = exports.TXN_HOLD_STATUSES = exports.TXN_HOLD_DOC_TYPES = exports.TXN_HOLD_SRC_MODULES = exports.TXN_HOLD_KINDS = exports.TxnHoldPartyType = exports.TxnHoldStatus = exports.TxnHoldDocType = exports.TxnHoldSrcModule = exports.TxnHoldKind = void 0;
var TxnHoldKind;
(function (TxnHoldKind) {
    TxnHoldKind["HOLD"] = "HOLD";
    TxnHoldKind["AUTOSAVE"] = "AUTOSAVE";
    TxnHoldKind["TEMPLATE"] = "TEMPLATE";
})(TxnHoldKind || (exports.TxnHoldKind = TxnHoldKind = {}));
var TxnHoldSrcModule;
(function (TxnHoldSrcModule) {
    TxnHoldSrcModule["SALES"] = "SALES";
    TxnHoldSrcModule["PURCHASE"] = "PURCHASE";
    TxnHoldSrcModule["INVENTORY"] = "INVENTORY";
    TxnHoldSrcModule["ACCOUNTS"] = "ACCOUNTS";
    TxnHoldSrcModule["POS"] = "POS";
    TxnHoldSrcModule["SERVICE"] = "SERVICE";
    TxnHoldSrcModule["OTHER"] = "OTHER";
})(TxnHoldSrcModule || (exports.TxnHoldSrcModule = TxnHoldSrcModule = {}));
var TxnHoldDocType;
(function (TxnHoldDocType) {
    TxnHoldDocType["QUOTATION"] = "QUOTATION";
    TxnHoldDocType["SALES_ORDER"] = "SALES_ORDER";
    TxnHoldDocType["DELIVERY_CHALLAN"] = "DELIVERY_CHALLAN";
    TxnHoldDocType["SALE_BILL"] = "SALE_BILL";
    TxnHoldDocType["SALE_RETURN"] = "SALE_RETURN";
    TxnHoldDocType["PURCHASE_ORDER"] = "PURCHASE_ORDER";
    TxnHoldDocType["PURCHASE_BILL"] = "PURCHASE_BILL";
    TxnHoldDocType["PURCHASE_RETURN"] = "PURCHASE_RETURN";
    TxnHoldDocType["STOCK_TRANSFER"] = "STOCK_TRANSFER";
    TxnHoldDocType["STOCK_ADJUSTMENT"] = "STOCK_ADJUSTMENT";
    TxnHoldDocType["RECEIPT"] = "RECEIPT";
    TxnHoldDocType["PAYMENT"] = "PAYMENT";
    TxnHoldDocType["JOURNAL"] = "JOURNAL";
    TxnHoldDocType["OTHER"] = "OTHER";
})(TxnHoldDocType || (exports.TxnHoldDocType = TxnHoldDocType = {}));
var TxnHoldStatus;
(function (TxnHoldStatus) {
    TxnHoldStatus["HELD"] = "HELD";
    TxnHoldStatus["LOCKED"] = "LOCKED";
    TxnHoldStatus["RESUMED"] = "RESUMED";
    TxnHoldStatus["CONVERTED"] = "CONVERTED";
    TxnHoldStatus["EXPIRED"] = "EXPIRED";
    TxnHoldStatus["CANCELLED"] = "CANCELLED";
    TxnHoldStatus["ABANDONED"] = "ABANDONED";
})(TxnHoldStatus || (exports.TxnHoldStatus = TxnHoldStatus = {}));
var TxnHoldPartyType;
(function (TxnHoldPartyType) {
    TxnHoldPartyType["CUSTOMER"] = "CUSTOMER";
    TxnHoldPartyType["SUPPLIER"] = "SUPPLIER";
    TxnHoldPartyType["EMPLOYEE"] = "EMPLOYEE";
    TxnHoldPartyType["LEDGER"] = "LEDGER";
    TxnHoldPartyType["BRANCH"] = "BRANCH";
    TxnHoldPartyType["OTHER"] = "OTHER";
})(TxnHoldPartyType || (exports.TxnHoldPartyType = TxnHoldPartyType = {}));
exports.TXN_HOLD_KINDS = Object.values(TxnHoldKind);
exports.TXN_HOLD_SRC_MODULES = Object.values(TxnHoldSrcModule);
exports.TXN_HOLD_DOC_TYPES = Object.values(TxnHoldDocType);
exports.TXN_HOLD_STATUSES = Object.values(TxnHoldStatus);
exports.TXN_HOLD_PARTY_TYPES = Object.values(TxnHoldPartyType);
exports.TXN_HOLD_CLOSED_STATUSES = [
    TxnHoldStatus.CONVERTED,
    TxnHoldStatus.EXPIRED,
    TxnHoldStatus.CANCELLED,
    TxnHoldStatus.ABANDONED,
];
exports.TXN_HOLD_IN_USE_STATUSES = [
    TxnHoldStatus.LOCKED,
    TxnHoldStatus.RESUMED,
];
exports.TXN_HOLD_EXPIRABLE_STATUSES = [
    TxnHoldStatus.HELD,
    TxnHoldStatus.LOCKED,
];
exports.TXN_HOLD_VALUE_GUARDS = [
    { field: 'txhKind', allowed: exports.TXN_HOLD_KINDS, nullable: false },
    { field: 'txhSrcModule', allowed: exports.TXN_HOLD_SRC_MODULES, nullable: false },
    { field: 'txhDocType', allowed: exports.TXN_HOLD_DOC_TYPES, nullable: false },
    { field: 'txhStatus', allowed: exports.TXN_HOLD_STATUSES, nullable: false },
    { field: 'txhPartyType', allowed: exports.TXN_HOLD_PARTY_TYPES, nullable: true },
];
exports.TXN_HOLD_LOCK_TTL_SECONDS_MIN = 30;
exports.TXN_HOLD_LOCK_TTL_SECONDS_MAX = 86_400;
exports.TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT = 900;
//# sourceMappingURL=txn-hold-api.types.js.map