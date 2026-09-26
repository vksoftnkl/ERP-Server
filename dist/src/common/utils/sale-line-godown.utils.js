"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleGodownKey = void 0;
exports.branchDefaultGodownId = branchDefaultGodownId;
exports.resolveDefaultSaleGodowns = resolveDefaultSaleGodowns;
exports.saleLineAllowsNegativeStock = saleLineAllowsNegativeStock;
const saleGodownKey = (line) => `${line.itemId}|${line.iucId}`;
exports.saleGodownKey = saleGodownKey;
async function branchDefaultGodownId(prisma, branchId) {
    const branch = await prisma.branchMaster.findFirst({
        where: { brId: branchId },
        select: { brDefaultGodownId: true },
    });
    if (!branch?.brDefaultGodownId)
        return null;
    const godown = await prisma.godownLocation.findFirst({
        where: { gdlId: branch.brDefaultGodownId, gdlIsDeleted: false },
        select: { gdlId: true },
    });
    return godown?.gdlId ?? null;
}
async function resolveDefaultSaleGodowns(prisma, branchId, lines) {
    const result = new Map();
    if (lines.length === 0)
        return result;
    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const [priceRows, branchDefault] = await Promise.all([
        prisma.itemPriceMaster.findMany({
            where: {
                ipmItemId: { in: itemIds },
                OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }],
                ipmIsDeleted: false,
            },
            select: { ipmItemId: true, ipmUcUnitId: true, ipmBranchId: true, ipmGodownId: true },
            orderBy: { ipmId: 'asc' },
        }),
        branchDefaultGodownId(prisma, branchId),
    ]);
    const rowByKey = new Map();
    for (const row of priceRows) {
        const key = (0, exports.saleGodownKey)({ itemId: row.ipmItemId, iucId: row.ipmUcUnitId });
        const current = rowByKey.get(key);
        if (!current || (current.ipmBranchId !== branchId && row.ipmBranchId === branchId)) {
            rowByKey.set(key, row);
        }
    }
    const godownIdByKey = new Map();
    for (const line of lines) {
        const key = (0, exports.saleGodownKey)(line);
        godownIdByKey.set(key, rowByKey.get(key)?.ipmGodownId ?? branchDefault);
    }
    const godownIds = [
        ...new Set([...godownIdByKey.values()].filter((id) => id !== null)),
    ];
    const godowns = godownIds.length
        ? await prisma.godownLocation.findMany({
            where: { gdlId: { in: godownIds } },
            select: { gdlId: true, gdlName: true, gdlNegativeStock: true },
        })
        : [];
    const godownById = new Map(godowns.map((godown) => [godown.gdlId, godown]));
    for (const [key, godownId] of godownIdByKey) {
        result.set(key, godownId ? (godownById.get(godownId) ?? null) : null);
    }
    return result;
}
function saleLineAllowsNegativeStock(item, godownAllowsNegStock, companyAllowsNegStock) {
    return (item.itemIsService ||
        !(godownAllowsNegStock === false &&
            companyAllowsNegStock === false &&
            item.itemAllowNegStock === false));
}
//# sourceMappingURL=sale-line-godown.utils.js.map