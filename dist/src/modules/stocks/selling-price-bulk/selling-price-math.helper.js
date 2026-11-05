"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exclusiveOfTax = exclusiveOfTax;
exports.recomputeLevel = recomputeLevel;
const SCALE = 6;
function round(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const factor = 10 ** SCALE;
    return Math.round(value * factor) / factor;
}
function exclusiveOfTax(withTax, taxPerc) {
    const divisor = 1 + taxPerc / 100;
    return divisor <= 0 ? round(withTax) : round(withTax / divisor);
}
function recomputeLevel(level, price, taxPerc, costRate) {
    const priceWithTax = round(price);
    const priceWot = exclusiveOfTax(priceWithTax, taxPerc);
    const costWot = exclusiveOfTax(costRate, taxPerc);
    return {
        level,
        price: priceWithTax,
        priceWot,
        markupPerc: costRate > 0 ? round(((priceWithTax - costRate) / costRate) * 100) : 0,
        marginPerc: costRate > 0 && priceWot > 0 ? round(((priceWot - costWot) / priceWot) * 100) : 0,
    };
}
//# sourceMappingURL=selling-price-math.helper.js.map