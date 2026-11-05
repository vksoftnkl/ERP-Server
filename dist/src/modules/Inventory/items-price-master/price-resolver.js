"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_BUCKET_KEY = exports.HEADLINE_KEY = void 0;
exports.resolveEffectivePrice = resolveEffectivePrice;
exports.livePriceRows = livePriceRows;
exports.isHeadlineKey = isHeadlineKey;
exports.bucketKeyOfRow = bucketKeyOfRow;
exports.normalizeBucketValue = normalizeBucketValue;
exports.sameBucket = sameBucket;
exports.scopeOf = scopeOf;
exports.toDay = toDay;
exports.HEADLINE_KEY = Object.freeze({ mrp: null, salePrice: null });
exports.NO_BUCKET_KEY = -1;
function resolveEffectivePrice(rows, key, onDate, caller = {}) {
    const live = livePriceRows(rows, onDate, caller);
    const wanted = keyOf(key);
    const exact = mostSpecific(live.filter((row) => rowKeyEquals(row, wanted)));
    if (exact && !isHeadlineKey(key)) {
        return { row: exact, source: 'BUCKET', scope: scopeOf(exact) };
    }
    const headline = mostSpecific(live.filter((row) => rowKeyEquals(row, keyOf(exports.HEADLINE_KEY))));
    return headline ? { row: headline, source: 'MASTER', scope: scopeOf(headline) } : null;
}
function livePriceRows(rows, onDate, caller = {}) {
    return rows.filter((row) => isInForce(row, onDate) && isInScope(row, caller));
}
function isHeadlineKey(key) {
    return key.mrp === null && key.salePrice === null;
}
function bucketKeyOfRow(row) {
    const mrp = toAmount(row.ipmKeyMrp);
    const salePrice = toAmount(row.ipmKeySp);
    return {
        mrp: mrp === null || sameAmount(mrp, exports.NO_BUCKET_KEY) ? null : mrp,
        salePrice: salePrice === null || sameAmount(salePrice, exports.NO_BUCKET_KEY) ? null : salePrice,
    };
}
function normalizeBucketValue(value) {
    const amount = toAmount(value);
    return amount !== null && amount > 0 ? amount : null;
}
function sameBucket(a, b) {
    return nullableEquals(a.mrp, b.mrp) && nullableEquals(a.salePrice, b.salePrice);
}
function scopeOf(row) {
    return row.ipmBranchId === null ? 'CHAIN' : 'BRANCH';
}
function toDay(value) {
    return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
function isInForce(row, onDate) {
    const day = onDate.slice(0, 10);
    return (!row.ipmIsDeleted && toDay(row.ipmEffectiveFrom) <= day && day <= toDay(row.ipmEffectiveTo));
}
function isInScope(row, caller) {
    const companyOk = !caller.companyId || row.ipmCompanyId === null || row.ipmCompanyId === caller.companyId;
    const branchOk = !caller.branchId || row.ipmBranchId === null || row.ipmBranchId === caller.branchId;
    return companyOk && branchOk;
}
function mostSpecific(rows) {
    let best = null;
    let bestRank = Number.POSITIVE_INFINITY;
    for (const row of rows) {
        const rank = (row.ipmBranchId === null ? 2 : 0) + (row.ipmCompanyId === null ? 1 : 0);
        if (rank < bestRank) {
            best = row;
            bestRank = rank;
        }
    }
    return best;
}
function keyOf(key) {
    return {
        mrp: key.mrp ?? exports.NO_BUCKET_KEY,
        salePrice: key.salePrice ?? exports.NO_BUCKET_KEY,
    };
}
function rowKeyEquals(row, wanted) {
    return (sameAmount(toAmount(row.ipmKeyMrp) ?? exports.NO_BUCKET_KEY, wanted.mrp) &&
        sameAmount(toAmount(row.ipmKeySp) ?? exports.NO_BUCKET_KEY, wanted.salePrice));
}
function toAmount(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const amount = typeof value === 'number' ? value : Number(value.toString());
    return Number.isFinite(amount) ? amount : null;
}
function sameAmount(a, b) {
    return Math.abs(a - b) < 5e-7;
}
function nullableEquals(a, b) {
    return a === null || b === null ? a === b : sameAmount(a, b);
}
//# sourceMappingURL=price-resolver.js.map