"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_LEVEL = exports.GODOWN_TREE = exports.ITEM_CATEGORY_TREE = exports.ITEM_SECTION_TREE = exports.ITEM_BRAND_TREE = exports.ITEM_GROUP_TREE = void 0;
exports.assertNotUnderOwnSubtree = assertNotUnderOwnSubtree;
exports.relevelSubtree = relevelSubtree;
exports.assertNoLiveChildren = assertNoLiveChildren;
exports.assertParentLive = assertParentLive;
exports.countLiveReferences = countLiveReferences;
exports.assertNoLiveReferences = assertNoLiveReferences;
exports.assertDeleteState = assertDeleteState;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
exports.ITEM_GROUP_TREE = {
    table: 'inventory.item_group_master',
    id: 'itg_id',
    parent: 'itg_parent_id',
    level: 'itg_level',
    deleted: 'itg_is_deleted',
    name: 'itg_name',
    label: 'item group',
    parentField: 'itg_parent_id',
    idField: 'itg_id',
};
exports.ITEM_BRAND_TREE = {
    table: 'inventory.item_brand_master',
    id: 'brand_id',
    parent: 'brand_parent_id',
    level: 'brand_level',
    deleted: 'brand_is_deleted',
    name: 'brand_name',
    label: 'item brand',
    parentField: 'brand_parent_id',
    idField: 'brand_id',
};
exports.ITEM_SECTION_TREE = {
    table: 'inventory.item_section_master',
    id: 'sec_id',
    parent: 'sec_parent_id',
    level: 'sec_level',
    deleted: 'sec_is_deleted',
    name: 'sec_name',
    label: 'item section',
    parentField: 'sec_parent_id',
    idField: 'sec_id',
};
exports.ITEM_CATEGORY_TREE = {
    table: 'inventory.item_category_master',
    id: 'category_id',
    parent: 'category_parent_id',
    level: 'category_level',
    deleted: 'category_is_deleted',
    name: 'category_name',
    label: 'item category',
    parentField: 'category_parent_id',
    idField: 'category_id',
};
exports.GODOWN_TREE = {
    table: 'inventory.godown_locations',
    id: 'gdl_id',
    parent: 'gdl_parent_id',
    level: 'gdl_level',
    deleted: 'gdl_is_deleted',
    name: 'gdl_name',
    label: 'godown location',
    parentField: 'gdl_parent_id',
    idField: 'gdl_id',
};
exports.ROOT_LEVEL = 1;
const MAX_DEPTH = 64;
const ident = (value) => client_1.Prisma.raw(value);
async function assertNotUnderOwnSubtree(client, tree, nodeId, newParentId) {
    if (!newParentId) {
        return;
    }
    if (newParentId === nodeId) {
        (0, module_service_utils_1.throwInventoryBadRequest)(`This ${tree.label} cannot be its own parent`, [
            {
                field: tree.parentField,
                message: `${tree.parentField} cannot be the same as ${tree.idField}`,
            },
        ]);
    }
    const t = tree;
    const [row] = await client.$queryRaw `
    WITH RECURSIVE up(id, parent, depth) AS (
      SELECT n.${ident(t.id)}, n.${ident(t.parent)}, 1
        FROM ${ident(t.table)} n
       WHERE n.${ident(t.id)} = ${newParentId}::uuid
      UNION ALL
      SELECT p.${ident(t.id)}, p.${ident(t.parent)}, up.depth + 1
        FROM ${ident(t.table)} p
        JOIN up ON p.${ident(t.id)} = up.parent
       WHERE up.depth < ${MAX_DEPTH}
    )
    SELECT EXISTS (SELECT 1 FROM up WHERE up.id = ${nodeId}::uuid) AS hit
  `;
    if (row?.hit) {
        (0, module_service_utils_1.throwInventoryBadRequest)(`This ${tree.label} cannot be moved under one of its own descendants`, [
            {
                field: tree.parentField,
                message: `${tree.parentField} ${newParentId} is below this ${tree.label} in the tree; ` +
                    'moving it there would make a loop.',
            },
        ]);
    }
}
async function relevelSubtree(client, tree, nodeId) {
    const t = tree;
    await client.$executeRaw `
    WITH RECURSIVE up(id, parent, depth) AS (
      SELECT n.${ident(t.id)}, n.${ident(t.parent)}, 1
        FROM ${ident(t.table)} n
       WHERE n.${ident(t.id)} = ${nodeId}::uuid
      UNION ALL
      SELECT p.${ident(t.id)}, p.${ident(t.parent)}, up.depth + 1
        FROM ${ident(t.table)} p
        JOIN up ON p.${ident(t.id)} = up.parent
       WHERE up.depth < ${MAX_DEPTH}
    ),
    down(id, lvl) AS (
      SELECT ${nodeId}::uuid, (SELECT max(depth) FROM up)
      UNION ALL
      SELECT c.${ident(t.id)}, down.lvl + 1
        FROM ${ident(t.table)} c
        JOIN down ON c.${ident(t.parent)} = down.id
       WHERE down.lvl < ${2 * MAX_DEPTH}
    )
    UPDATE ${ident(t.table)} x
       SET ${ident(t.level)} = down.lvl
      FROM down
     WHERE x.${ident(t.id)} = down.id
       AND x.${ident(t.level)} IS DISTINCT FROM down.lvl
  `;
}
async function assertNoLiveChildren(client, tree, nodeId) {
    const t = tree;
    const [row] = await client.$queryRaw `
    SELECT count(*) AS n,
           (array_agg(c.${ident(t.name)}::text ORDER BY c.${ident(t.name)}))[1:3] AS names
      FROM ${ident(t.table)} c
     WHERE c.${ident(t.parent)} = ${nodeId}::uuid
       AND c.${ident(t.deleted)} = false
  `;
    const count = Number(row?.n ?? 0);
    if (count > 0) {
        (0, module_service_utils_1.throwInventoryConflict)(`This ${tree.label} still has live children`, [
            {
                field: tree.idField,
                message: `${count} live ${tree.label}${count === 1 ? '' : 's'} sit under it ` +
                    `(${(row?.names ?? []).join(', ')}${count > 3 ? ', …' : ''}). ` +
                    'Delete or move them first.',
            },
        ]);
    }
}
async function assertParentLive(client, tree, parentId) {
    if (!parentId) {
        return;
    }
    const t = tree;
    const [row] = await client.$queryRaw `
    SELECT EXISTS (
      SELECT 1 FROM ${ident(t.table)} p
       WHERE p.${ident(t.id)} = ${parentId}::uuid AND p.${ident(t.deleted)} = false
    ) AS live
  `;
    if (!row?.live) {
        (0, module_service_utils_1.throwInventoryConflict)(`The parent ${tree.label} is deleted`, [
            {
                field: tree.parentField,
                message: `Restore the parent ${tree.label} ${parentId} first, or move this row after restoring it.`,
            },
        ]);
    }
}
async function countLiveReferences(client, references, id) {
    if (!references.length) {
        return [];
    }
    const parts = references.map((ref, index) => client_1.Prisma.sql `
      SELECT ${index}::int AS ord, count(*) AS n
        FROM ${ident(ref.table)}
       WHERE ${ident(ref.column)} = ${id}::uuid AND ${ident(ref.live)}`);
    const rows = await client.$queryRaw `
    ${client_1.Prisma.join(parts, ' UNION ALL ')}
  `;
    const byOrd = new Map(rows.map((row) => [Number(row.ord), Number(row.n)]));
    return references.map((ref, index) => ({ label: ref.label, count: byOrd.get(index) ?? 0 }));
}
async function assertNoLiveReferences(client, references, id, what) {
    const used = (await countLiveReferences(client, references, id)).filter((ref) => ref.count > 0);
    if (!used.length) {
        return;
    }
    (0, module_service_utils_1.throwInventoryConflict)(`This ${what.label} is still in use`, [
        {
            field: what.idField,
            message: `Used by ${used.map((ref) => `${ref.count} ${ref.label}`).join(', ')}. ` +
                `Re-point or delete those first; a deleted ${what.label} would vanish from every picker ` +
                'while they keep using it.',
        },
    ]);
}
function assertDeleteState(isDeleted, wantDeleted, what) {
    if (isDeleted === wantDeleted) {
        (0, module_service_utils_1.throwInventoryConflict)(wantDeleted ? `This ${what.label} is already deleted` : `This ${what.label} is not deleted`, [
            {
                field: what.idField,
                message: wantDeleted
                    ? `Nothing to delete. To bring it back use POST ${what.restoreRoute}.`
                    : 'Nothing to restore.',
            },
        ]);
    }
}
//# sourceMappingURL=master-tree.helper.js.map