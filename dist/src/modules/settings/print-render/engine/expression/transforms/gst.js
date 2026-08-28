"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gstExclusive = exports.isInterState = exports.gstSplit = void 0;
const scalar_1 = require("./scalar");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const toNumber = (value) => {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};
const gstSplit = (taxableValue, combinedRate, interState = false) => {
    const taxable = toNumber(taxableValue);
    const rate = toNumber(combinedRate);
    const isInterStateSupply = Boolean(interState);
    if (isInterStateSupply) {
        const igstAmount = round2((taxable * rate) / 100);
        return {
            cgstRate: 0,
            sgstRate: 0,
            igstRate: rate,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount,
            totalTax: igstAmount,
            interState: true,
        };
    }
    const halfRate = rate / 2;
    const cgstAmount = round2((taxable * halfRate) / 100);
    const totalTax = round2((taxable * rate) / 100);
    const sgstAmount = round2(totalTax - cgstAmount);
    return {
        cgstRate: halfRate,
        sgstRate: halfRate,
        igstRate: 0,
        cgstAmount,
        sgstAmount,
        igstAmount: 0,
        totalTax,
        interState: false,
    };
};
exports.gstSplit = gstSplit;
const isInterState = (supplierGstin, recipientGstin) => {
    const supplierCode = (0, scalar_1.scalarToString)(supplierGstin).trim().slice(0, 2);
    const recipientCode = (0, scalar_1.scalarToString)(recipientGstin).trim().slice(0, 2);
    if (!supplierCode || !recipientCode) {
        return false;
    }
    return supplierCode !== recipientCode;
};
exports.isInterState = isInterState;
const gstExclusive = (inclusiveAmount, combinedRate) => {
    const inclusive = toNumber(inclusiveAmount);
    const rate = toNumber(combinedRate);
    return round2(inclusive / (1 + rate / 100));
};
exports.gstExclusive = gstExclusive;
//# sourceMappingURL=gst.js.map