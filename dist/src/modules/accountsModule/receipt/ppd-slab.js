"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePpdSlabs = parsePpdSlabs;
exports.suggestPpdDiscount = suggestPpdDiscount;
const receipt_utils_1 = require("./receipt.utils");
function parsePpdSlabs(raw) {
    if (!raw || raw.trim().length === 0) {
        return [];
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const slabs = [];
    for (const entry of parsed) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const days = entry.days;
        const perc = entry.perc;
        if (typeof days !== 'number' || typeof perc !== 'number') {
            continue;
        }
        if (!Number.isFinite(days) || !Number.isFinite(perc)) {
            continue;
        }
        if (days < 0 || perc <= 0 || perc >= 100) {
            continue;
        }
        slabs.push({ days: Math.floor(days), perc });
    }
    return slabs;
}
function suggestPpdDiscount(params) {
    const { docDate, onDate, pendingAmount, slabs } = params;
    if (slabs.length === 0 || pendingAmount.lessThanOrEqualTo(0)) {
        return receipt_utils_1.ZERO;
    }
    const age = Math.max(0, (0, receipt_utils_1.daysBetween)(docDate, onDate));
    let best = null;
    for (const slab of slabs) {
        if (age > slab.days) {
            continue;
        }
        if (best === null || slab.perc > best.perc) {
            best = slab;
        }
    }
    if (best === null) {
        return receipt_utils_1.ZERO;
    }
    return (0, receipt_utils_1.money)(pendingAmount.times(best.perc).dividedBy(100));
}
//# sourceMappingURL=ppd-slab.js.map