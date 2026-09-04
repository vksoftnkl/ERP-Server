"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemStockBucket = exports.ItemStockBalanceTrackingType = exports.StockTxnType = exports.StockTrackingType = void 0;
var StockTrackingType;
(function (StockTrackingType) {
    StockTrackingType["NONE"] = "NONE";
    StockTrackingType["MRP"] = "MRP";
    StockTrackingType["BATCH"] = "BATCH";
})(StockTrackingType || (exports.StockTrackingType = StockTrackingType = {}));
var StockTxnType;
(function (StockTxnType) {
    StockTxnType["OPENING"] = "OPENING";
    StockTxnType["PURCHASE"] = "PURCHASE";
    StockTxnType["PURCHASE_RETURN"] = "PURCHASE_RETURN";
    StockTxnType["SALE"] = "SALE";
    StockTxnType["SALES_RETURN"] = "SALES_RETURN";
    StockTxnType["TRANSFER_IN"] = "TRANSFER_IN";
    StockTxnType["TRANSFER_OUT"] = "TRANSFER_OUT";
    StockTxnType["ADJUSTMENT_IN"] = "ADJUSTMENT_IN";
    StockTxnType["ADJUSTMENT_OUT"] = "ADJUSTMENT_OUT";
    StockTxnType["PRODUCTION_IN"] = "PRODUCTION_IN";
    StockTxnType["CONSUMPTION"] = "CONSUMPTION";
    StockTxnType["DAMAGE"] = "DAMAGE";
    StockTxnType["EXPIRED"] = "EXPIRED";
})(StockTxnType || (exports.StockTxnType = StockTxnType = {}));
var ItemStockBalanceTrackingType;
(function (ItemStockBalanceTrackingType) {
    ItemStockBalanceTrackingType["NONE"] = "NONE";
    ItemStockBalanceTrackingType["MRP"] = "MRP";
    ItemStockBalanceTrackingType["BATCH"] = "BATCH";
})(ItemStockBalanceTrackingType || (exports.ItemStockBalanceTrackingType = ItemStockBalanceTrackingType = {}));
var ItemStockBucket;
(function (ItemStockBucket) {
    ItemStockBucket["SALEABLE"] = "SALEABLE";
    ItemStockBucket["DAMAGED"] = "DAMAGED";
    ItemStockBucket["EXPIRED"] = "EXPIRED";
    ItemStockBucket["HOLD"] = "HOLD";
    ItemStockBucket["RETURN"] = "RETURN";
})(ItemStockBucket || (exports.ItemStockBucket = ItemStockBucket = {}));
//# sourceMappingURL=item-stock.types.js.map