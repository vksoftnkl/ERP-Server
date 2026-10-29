"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_VALUATION_METHODS = void 0;
exports.valuationMethodFor = valuationMethodFor;
exports.STOCK_VALUATION_METHODS = ['WAVG', 'LOT_ACTUAL'];
function valuationMethodFor(flags) {
    return flags.trackBatch ||
        flags.trackMrp ||
        flags.trackSalePrice ||
        flags.trackExpiry ||
        flags.trackSerial ||
        flags.trackSupplier
        ? 'LOT_ACTUAL'
        : 'WAVG';
}
//# sourceMappingURL=stock-track-policy.types.js.map