"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGroupTree = buildGroupTree;
exports.rollupGroupId = rollupGroupId;
exports.groupsRollingInto = groupsRollingInto;
exports.treeSortKey = treeSortKey;
function buildGroupTree(rows) {
    const nodes = new Map(rows.map((r) => [r.id, r]));
    const classes = new Map();
    const withChildren = new Set();
    for (const node of rows) {
        if (node.parentId && !node.isDeleted && nodes.has(node.parentId)) {
            withChildren.add(node.parentId);
        }
        const chain = [];
        const seen = new Set();
        let at = node;
        while (at && !seen.has(at.id)) {
            seen.add(at.id);
            chain.push(at.id);
            at = at.parentId ? nodes.get(at.parentId) : undefined;
        }
        let moneyKind = null;
        for (const id of chain) {
            const profile = nodes.get(id)?.profile?.trim() ?? 'General';
            if (profile !== 'General' && profile !== '') {
                moneyKind = profile === 'Cash' ? 'CASH' : profile === 'Bank' ? 'BANK' : null;
                break;
            }
        }
        classes.set(node.id, { chain, moneyKind });
    }
    return { nodes, classes, withChildren };
}
function rollupGroupId(tree, groupId, level) {
    const chain = tree.classes.get(groupId)?.chain;
    if (!chain || chain.length === 0 || level === 'LEDGER_GROUP') {
        return groupId;
    }
    if (level === 'PRIMARY' || chain.length === 1) {
        return chain[chain.length - 1];
    }
    return chain[chain.length - 2];
}
function groupsRollingInto(tree, targetId, level) {
    return [...tree.classes.keys()].filter((id) => rollupGroupId(tree, id, level) === targetId);
}
function treeSortKey(tree, groupId) {
    const chain = tree.classes.get(groupId)?.chain ?? [groupId];
    return [...chain]
        .reverse()
        .map((id) => {
        const node = tree.nodes.get(id);
        const sort = node?.sort ?? 999999;
        const shifted = String(Math.max(0, Math.min(sort + 500000, 9999999))).padStart(7, '0');
        return `${shifted}:${(node?.name ?? id).toLowerCase()}`;
    })
        .join('\u0001');
}
//# sourceMappingURL=day-summary.groups.js.map