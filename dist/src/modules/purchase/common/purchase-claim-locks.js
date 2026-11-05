"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHORTAGE_CLAIM_LOCK = exports.RETURN_CLAIM_LOCK = void 0;
exports.claimLockKeyOf = claimLockKeyOf;
exports.claimLockOrder = claimLockOrder;
exports.lockClaims = lockClaims;
exports.RETURN_CLAIM_LOCK = 'purchase_claim';
exports.SHORTAGE_CLAIM_LOCK = 'purchase_shortage_claim';
function claimLockKeyOf(row) {
    if (row.shortageCloseId)
        return { ns: exports.SHORTAGE_CLAIM_LOCK, id: row.shortageCloseId };
    if (row.returnItemId)
        return { ns: exports.RETURN_CLAIM_LOCK, id: row.returnItemId };
    return null;
}
function claimLockOrder(rows) {
    const seen = new Map();
    for (const r of rows) {
        const k = claimLockKeyOf(r);
        if (!k)
            continue;
        const key = { ns: k.ns, id: k.id.toLowerCase() };
        seen.set(`${key.ns}|${key.id}`, key);
    }
    return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, k]) => k);
}
async function lockClaims(tx, keys) {
    for (const k of keys) {
        await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext(${k.ns}), hashtext(${k.id})))::int AS locked`;
    }
}
//# sourceMappingURL=purchase-claim-locks.js.map