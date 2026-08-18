"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicalStockResolution = exports.PhysicalStockRateSource = exports.PhysicalStockPostingMode = exports.PhysicalStockCountType = void 0;
var PhysicalStockCountType;
(function (PhysicalStockCountType) {
    PhysicalStockCountType["FULL"] = "FULL";
    PhysicalStockCountType["PARTIAL"] = "PARTIAL";
    PhysicalStockCountType["ITEM_GROUP"] = "ITEM_GROUP";
    PhysicalStockCountType["BRAND"] = "BRAND";
    PhysicalStockCountType["BIN"] = "BIN";
    PhysicalStockCountType["BATCH"] = "BATCH";
})(PhysicalStockCountType || (exports.PhysicalStockCountType = PhysicalStockCountType = {}));
var PhysicalStockPostingMode;
(function (PhysicalStockPostingMode) {
    PhysicalStockPostingMode["ADJUST_DIFFERENCE_ONLY"] = "ADJUST_DIFFERENCE_ONLY";
    PhysicalStockPostingMode["REPLACE_BOOK_STOCK"] = "REPLACE_BOOK_STOCK";
})(PhysicalStockPostingMode || (exports.PhysicalStockPostingMode = PhysicalStockPostingMode = {}));
var PhysicalStockRateSource;
(function (PhysicalStockRateSource) {
    PhysicalStockRateSource["AVG_COST"] = "AVG_COST";
    PhysicalStockRateSource["LAST_PURCHASE"] = "LAST_PURCHASE";
    PhysicalStockRateSource["MANUAL"] = "MANUAL";
    PhysicalStockRateSource["FIFO"] = "FIFO";
})(PhysicalStockRateSource || (exports.PhysicalStockRateSource = PhysicalStockRateSource = {}));
var PhysicalStockResolution;
(function (PhysicalStockResolution) {
    PhysicalStockResolution["ADJUST_LOSS_GAIN"] = "ADJUST_LOSS_GAIN";
    PhysicalStockResolution["RECLASSIFY"] = "RECLASSIFY";
    PhysicalStockResolution["CORRECT_SOURCE_DOC"] = "CORRECT_SOURCE_DOC";
    PhysicalStockResolution["RECOUNT_REQUIRED"] = "RECOUNT_REQUIRED";
    PhysicalStockResolution["IGNORE_ZERO"] = "IGNORE_ZERO";
})(PhysicalStockResolution || (exports.PhysicalStockResolution = PhysicalStockResolution = {}));
//# sourceMappingURL=physical-stock.enums.js.map