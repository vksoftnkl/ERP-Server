"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockTrackingType = exports.TransactionStatus = void 0;
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["DRAFT"] = "DRAFT";
    TransactionStatus["COUNTING"] = "COUNTING";
    TransactionStatus["COUNTED"] = "COUNTED";
    TransactionStatus["APPROVED"] = "APPROVED";
    TransactionStatus["POSTED"] = "POSTED";
    TransactionStatus["CANCELLED"] = "CANCELLED";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var StockTrackingType;
(function (StockTrackingType) {
    StockTrackingType["NONE"] = "NONE";
    StockTrackingType["BATCH"] = "BATCH";
    StockTrackingType["MRP"] = "MRP";
    StockTrackingType["SERIAL"] = "SERIAL";
})(StockTrackingType || (exports.StockTrackingType = StockTrackingType = {}));
//# sourceMappingURL=transaction.enums.js.map