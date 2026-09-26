"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLoadingWeight = resolveLoadingWeight;
exports.selectLoadingSlab = selectLoadingSlab;
const client_1 = require("@prisma/client");
function resolveLoadingWeight(uomWeight) {
    const weight = new client_1.Prisma.Decimal(uomWeight);
    return weight.gt(0) ? weight : null;
}
function selectLoadingSlab(slabs, companyId, branchId) {
    let best = null;
    let bestScore = -1;
    for (const slab of slabs) {
        const score = (slab.ilcCompId === companyId ? 2 : 0) + (slab.ilcBranchId === branchId ? 1 : 0);
        if (score > bestScore) {
            best = slab;
            bestScore = score;
        }
    }
    return best;
}
//# sourceMappingURL=loading-charge.utils.js.map