import { Prisma } from '@prisma/client';
import {
  throwInventoryBadRequest,
  throwInventoryConflict,
} from 'src/common/utils/module-service.utils';
import type { InventoryErrorDetail } from 'src/common/utils/module-service.utils';
import { GodownErrorCode } from '../godowns-master/types/godown-error-codes';
import { ItemBrandErrorCode } from '../items-brand-master/types/item-brand-error-codes';
import { ItemCategoryErrorCode } from '../items-category-master/types/item-category-error-codes';
import { ItemGroupErrorCode } from '../items-group-master/types/item-group-error-codes';
import { ItemSectionErrorCode } from '../items-section-master/types/item-section-error-codes';

/**
 * THE HIERARCHY RULES every tree master shares (notes 70 §B): item group,
 * brand, section, category and godown each carry `*_parent_id` + `*_level`,
 * and each service used to re-implement — or skip — the same three rules:
 *
 *   B1/B2  `*_level` is the node's DEPTH (a root is 1), computed here and never
 *          taken from a payload, and a re-parent re-levels the whole subtree;
 *   B3     a node may not move under itself or any of its descendants — a cycle
 *          was accepted, and undoing it emptied both rows' path caches;
 *   B4     a node with live children (or live rows that reference it) is not
 *          deleted: the children stayed pointed at a deleted parent and showed
 *          up as root-looking orphans in every parent picker.
 *
 * Everything is one SQL statement per rule over the table named in a
 * `MasterTree` constant — trusted identifiers, never request values, which is
 * why they are `Prisma.raw`. The walks include deleted rows (a deleted node
 * still links its children) and stop at MAX_DEPTH, so legacy data with a cycle
 * in it cannot loop.
 */
/**
 * The `errors[].code` (notes 119) each hierarchy rule refuses with. The codes
 * belong to the master's own module enum; the helper only carries them.
 */
export interface MasterTreeCodes {
  /** B3 — the parent named is the node itself. */
  selfParent: string;
  /** B3 — the parent named sits inside the node's own subtree. */
  parentInSubtree: string;
  /** B4 — delete refused while live children sit under the node. */
  hasLiveChildren: string;
  /** Restore refused while the node's parent is deleted. */
  parentDeleted: string;
}

export interface MasterTree {
  /** Schema-qualified table. */
  table: string;
  id: string;
  parent: string;
  level: string;
  deleted: string;
  name: string;
  /** Lower-case noun for messages: "item group". */
  label: string;
  /** The payload field the parent arrives in, for error details. */
  parentField: string;
  /** The payload field the id arrives in. */
  idField: string;
  codes: MasterTreeCodes;
}

export const ITEM_GROUP_TREE: MasterTree = {
  table: 'inventory.item_group_master',
  id: 'itg_id',
  parent: 'itg_parent_id',
  level: 'itg_level',
  deleted: 'itg_is_deleted',
  name: 'itg_name',
  label: 'item group',
  parentField: 'itg_parent_id',
  idField: 'itg_id',
  codes: {
    selfParent: ItemGroupErrorCode.SELF_PARENT,
    parentInSubtree: ItemGroupErrorCode.PARENT_IN_SUBTREE,
    hasLiveChildren: ItemGroupErrorCode.HAS_CHILDREN,
    parentDeleted: ItemGroupErrorCode.PARENT_DELETED,
  },
};

export const ITEM_BRAND_TREE: MasterTree = {
  table: 'inventory.item_brand_master',
  id: 'brand_id',
  parent: 'brand_parent_id',
  level: 'brand_level',
  deleted: 'brand_is_deleted',
  name: 'brand_name',
  label: 'item brand',
  parentField: 'brand_parent_id',
  idField: 'brand_id',
  codes: {
    selfParent: ItemBrandErrorCode.SELF_PARENT,
    parentInSubtree: ItemBrandErrorCode.PARENT_IN_SUBTREE,
    hasLiveChildren: ItemBrandErrorCode.HAS_CHILDREN,
    parentDeleted: ItemBrandErrorCode.PARENT_DELETED,
  },
};

export const ITEM_SECTION_TREE: MasterTree = {
  table: 'inventory.item_section_master',
  id: 'sec_id',
  parent: 'sec_parent_id',
  level: 'sec_level',
  deleted: 'sec_is_deleted',
  name: 'sec_name',
  label: 'item section',
  parentField: 'sec_parent_id',
  idField: 'sec_id',
  codes: {
    selfParent: ItemSectionErrorCode.SELF_PARENT,
    parentInSubtree: ItemSectionErrorCode.PARENT_IN_SUBTREE,
    hasLiveChildren: ItemSectionErrorCode.HAS_CHILDREN,
    parentDeleted: ItemSectionErrorCode.PARENT_DELETED,
  },
};

export const ITEM_CATEGORY_TREE: MasterTree = {
  table: 'inventory.item_category_master',
  id: 'category_id',
  parent: 'category_parent_id',
  level: 'category_level',
  deleted: 'category_is_deleted',
  name: 'category_name',
  label: 'item category',
  parentField: 'category_parent_id',
  idField: 'category_id',
  codes: {
    selfParent: ItemCategoryErrorCode.SELF_PARENT,
    parentInSubtree: ItemCategoryErrorCode.PARENT_IN_SUBTREE,
    hasLiveChildren: ItemCategoryErrorCode.HAS_CHILDREN,
    parentDeleted: ItemCategoryErrorCode.PARENT_DELETED,
  },
};

export const GODOWN_TREE: MasterTree = {
  table: 'inventory.godown_locations',
  id: 'gdl_id',
  parent: 'gdl_parent_id',
  level: 'gdl_level',
  deleted: 'gdl_is_deleted',
  name: 'gdl_name',
  label: 'godown location',
  parentField: 'gdl_parent_id',
  idField: 'gdl_id',
  codes: {
    selfParent: GodownErrorCode.SELF_PARENT,
    parentInSubtree: GodownErrorCode.PARENT_IN_SUBTREE,
    hasLiveChildren: GodownErrorCode.HAS_CHILDREN,
    parentDeleted: GodownErrorCode.PARENT_DELETED,
  },
};

/**
 * Something that points at a master row and blocks its deletion while it is
 * live: `column = :id AND <live>`. `live` is a trusted SQL predicate over the
 * referencing table ("item_is_deleted = false", "sbl_on_hand_qty <> 0").
 */
export interface LiveReference {
  table: string;
  column: string;
  live: string;
  /** Plural noun for the message: "items", "ledgers". */
  label: string;
}

/** The level a root row gets. Section already used 1; every tree master does now. */
export const ROOT_LEVEL = 1;
/** A chain longer than this is corrupt, not deep: every walk stops here. */
const MAX_DEPTH = 64;

type RawClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

const ident = (value: string) => Prisma.raw(value);

/**
 * B3 — refuse to move `nodeId` under `newParentId` when that parent is the node
 * itself or one of its descendants: walk UP from the new parent and look for
 * the node. A null parent (moving to root) is always fine.
 */
export async function assertNotUnderOwnSubtree(
  client: RawClient,
  tree: MasterTree,
  nodeId: string,
  newParentId: string | null | undefined,
): Promise<void> {
  if (!newParentId) {
    return;
  }
  if (newParentId === nodeId) {
    throwInventoryBadRequest<InventoryErrorDetail>(`This ${tree.label} cannot be its own parent`, [
      {
        field: tree.parentField,
        code: tree.codes.selfParent,
        message: `${tree.parentField} cannot be the same as ${tree.idField}`,
      },
    ]);
  }
  const t = tree;
  const [row] = await client.$queryRaw<Array<{ hit: boolean }>>`
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
    throwInventoryBadRequest<InventoryErrorDetail>(
      `This ${tree.label} cannot be moved under one of its own descendants`,
      [
        {
          field: tree.parentField,
          code: tree.codes.parentInSubtree,
          message:
            `${tree.parentField} ${newParentId} is below this ${tree.label} in the tree; ` +
            'moving it there would make a loop.',
        },
      ],
    );
  }
}

/**
 * B1/B2 — set `nodeId`'s level to its depth (root = 1) and re-level every
 * descendant below it, in ONE statement. Call it after any create or update
 * that can change where the node sits; a no-op write when nothing moved.
 */
export async function relevelSubtree(
  client: RawClient,
  tree: MasterTree,
  nodeId: string,
): Promise<void> {
  const t = tree;
  await client.$executeRaw`
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

/**
 * B4 — refuse to delete a node while live children hang off it. They would
 * keep pointing at a deleted parent, resolve its name on GET, and show up as
 * root-looking orphans in every parent picker.
 */
export async function assertNoLiveChildren(
  client: RawClient,
  tree: MasterTree,
  nodeId: string,
): Promise<void> {
  const t = tree;
  const [row] = await client.$queryRaw<Array<{ n: bigint; names: string[] | null }>>`
    SELECT count(*) AS n,
           (array_agg(c.${ident(t.name)}::text ORDER BY c.${ident(t.name)}))[1:3] AS names
      FROM ${ident(t.table)} c
     WHERE c.${ident(t.parent)} = ${nodeId}::uuid
       AND c.${ident(t.deleted)} = false
  `;
  const count = Number(row?.n ?? 0);
  if (count > 0) {
    throwInventoryConflict<InventoryErrorDetail>(`This ${tree.label} still has live children`, [
      {
        field: tree.idField,
        code: tree.codes.hasLiveChildren,
        message:
          `${count} live ${tree.label}${count === 1 ? '' : 's'} sit under it ` +
          `(${(row?.names ?? []).join(', ')}${count > 3 ? ', …' : ''}). ` +
          'Delete or move them first.',
      },
    ]);
  }
}

/**
 * Restore — the parent must be live, or the row comes back as an orphan under
 * a deleted node.
 */
export async function assertParentLive(
  client: RawClient,
  tree: MasterTree,
  parentId: string | null,
): Promise<void> {
  if (!parentId) {
    return;
  }
  const t = tree;
  const [row] = await client.$queryRaw<Array<{ live: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM ${ident(t.table)} p
       WHERE p.${ident(t.id)} = ${parentId}::uuid AND p.${ident(t.deleted)} = false
    ) AS live
  `;
  if (!row?.live) {
    throwInventoryConflict<InventoryErrorDetail>(`The parent ${tree.label} is deleted`, [
      {
        field: tree.parentField,
        code: tree.codes.parentDeleted,
        message: `Restore the parent ${tree.label} ${parentId} first, or move this row after restoring it.`,
      },
    ]);
  }
}

/** Each reference's live count, in the order given. One statement. */
export async function countLiveReferences(
  client: RawClient,
  references: readonly LiveReference[],
  id: string,
): Promise<Array<{ label: string; count: number }>> {
  if (!references.length) {
    return [];
  }
  const parts = references.map(
    (ref, index) => Prisma.sql`
      SELECT ${index}::int AS ord, count(*) AS n
        FROM ${ident(ref.table)}
       WHERE ${ident(ref.column)} = ${id}::uuid AND ${ident(ref.live)}`,
  );
  const rows = await client.$queryRaw<Array<{ ord: number; n: bigint }>>`
    ${Prisma.join(parts, ' UNION ALL ')}
  `;
  const byOrd = new Map(rows.map((row) => [Number(row.ord), Number(row.n)]));
  return references.map((ref, index) => ({ label: ref.label, count: byOrd.get(index) ?? 0 }));
}

/**
 * B4 / C2 / C3 / C5 — refuse (409) to delete a master row that live rows still
 * point at. A soft delete takes the row out of every picker while the rows
 * pointing at it keep using it: a silent posting hazard for a tax rate, an
 * unsellable-but-valued holding for a godown.
 */
export async function assertNoLiveReferences(
  client: RawClient,
  references: readonly LiveReference[],
  id: string,
  what: { label: string; idField: string; inUseCode: string },
): Promise<void> {
  const used = (await countLiveReferences(client, references, id)).filter((ref) => ref.count > 0);
  if (!used.length) {
    return;
  }
  throwInventoryConflict<InventoryErrorDetail>(`This ${what.label} is still in use`, [
    {
      field: what.idField,
      code: what.inUseCode,
      message:
        `Used by ${used.map((ref) => `${ref.count} ${ref.label}`).join(', ')}. ` +
        `Re-point or delete those first; a deleted ${what.label} would vanish from every picker ` +
        'while they keep using it.',
    },
  ]);
}

/**
 * C1 — DELETE deletes and RESTORE restores; neither toggles. A second DELETE
 * on a deleted row used to bring it back (200 "restored successfully").
 */
export function assertDeleteState(
  isDeleted: boolean,
  wantDeleted: boolean,
  what: {
    label: string;
    idField: string;
    restoreRoute: string;
    /** Refusing a DELETE of a row that is already deleted. */
    alreadyDeletedCode: string;
    /** Refusing a RESTORE of a row that is not deleted. */
    notDeletedCode: string;
  },
): void {
  if (isDeleted === wantDeleted) {
    throwInventoryConflict<InventoryErrorDetail>(
      wantDeleted ? `This ${what.label} is already deleted` : `This ${what.label} is not deleted`,
      [
        {
          field: what.idField,
          code: wantDeleted ? what.alreadyDeletedCode : what.notDeletedCode,
          message: wantDeleted
            ? `Nothing to delete. To bring it back use POST ${what.restoreRoute}.`
            : 'Nothing to restore.',
        },
      ],
    );
  }
}
