import type { GroupLevel } from './types/day-summary.types';

/**
 * Plan §4.2 / §4.3 — what the group tree says about a ledger, computed once per
 * request from `acc_group_master` (a few dozen rows; no cache, no table).
 *
 *   money kind  the first non-'General' acc_ledger_profile walking UP from the
 *               ledger's group: 'Cash' → CASH, 'Bank' → BANK, anything else
 *               (Party, Tax, SalesPurchase …) → not money. led_ledger_type is
 *               NULL on too many ledgers to be the key (§3.4).
 *   REPORT      the group on the chain whose parent is a root; the root itself
 *               when the group IS a root. Cash-in-Hand, Bank Accounts and Sundry
 *               Debtors are children of Current Assets — rolling to the root
 *               would put them on one line.
 *   PRIMARY     the root.
 *   LEDGER_GROUP the group itself.
 *
 * The walk never trusts acc_group_primary_name (NULL on 23 groups, §3.7). A
 * parent that does not exist, or a cycle, ends the chain there (that node acts
 * as the root).
 */

export interface GroupNode {
  id: string;
  name: string;
  parentId: string | null;
  nature: string | null;
  profile: string | null;
  sort: number | null;
  isDeleted: boolean;
}

export interface GroupClass {
  /** The group itself up to its root, inclusive. */
  chain: string[];
  moneyKind: 'CASH' | 'BANK' | null;
}

export interface GroupTree {
  nodes: Map<string, GroupNode>;
  classes: Map<string, GroupClass>;
  /** Groups with at least one live child group. */
  withChildren: Set<string>;
}

export function buildGroupTree(rows: readonly GroupNode[]): GroupTree {
  const nodes = new Map(rows.map((r) => [r.id, r]));
  const classes = new Map<string, GroupClass>();
  const withChildren = new Set<string>();
  for (const node of rows) {
    if (node.parentId && !node.isDeleted && nodes.has(node.parentId)) {
      withChildren.add(node.parentId);
    }
    const chain: string[] = [];
    const seen = new Set<string>();
    let at: GroupNode | undefined = node;
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      chain.push(at.id);
      at = at.parentId ? nodes.get(at.parentId) : undefined;
    }
    let moneyKind: GroupClass['moneyKind'] = null;
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

/** The group a ledger of `groupId` rolls into at `level` (§4.3). Unknown ids roll to themselves. */
export function rollupGroupId(tree: GroupTree, groupId: string, level: GroupLevel): string {
  const chain = tree.classes.get(groupId)?.chain;
  if (!chain || chain.length === 0 || level === 'LEDGER_GROUP') {
    return groupId;
  }
  if (level === 'PRIMARY' || chain.length === 1) {
    return chain[chain.length - 1];
  }
  return chain[chain.length - 2];
}

/** Every group id that rolls into `targetId` at `level` (for /group-ledgers). */
export function groupsRollingInto(tree: GroupTree, targetId: string, level: GroupLevel): string[] {
  return [...tree.classes.keys()].filter((id) => rollupGroupId(tree, id, level) === targetId);
}

/**
 * A tree-order sort key: (acc_group_sort, name) of every node from the root
 * down to the group, so children follow their parent and siblings follow the
 * book's own order (Current Assets 60: Bank Accounts 61, Cash-in-Hand 62 …).
 */
export function treeSortKey(tree: GroupTree, groupId: string): string {
  const chain = tree.classes.get(groupId)?.chain ?? [groupId];
  return [...chain]
    .reverse()
    .map((id) => {
      const node = tree.nodes.get(id);
      const sort = node?.sort ?? 999999;
      const shifted = String(Math.max(0, Math.min(sort + 500000, 9999999))).padStart(7, '0');
      return `${shifted}:${(node?.name ?? id).toLowerCase()}`;
    })
    .join('\u0001'); // below every printable character: a parent sorts before its children
}
