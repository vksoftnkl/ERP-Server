import type { GroupLevel } from './types/day-summary.types';
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
    chain: string[];
    moneyKind: 'CASH' | 'BANK' | null;
}
export interface GroupTree {
    nodes: Map<string, GroupNode>;
    classes: Map<string, GroupClass>;
    withChildren: Set<string>;
}
export declare function buildGroupTree(rows: readonly GroupNode[]): GroupTree;
export declare function rollupGroupId(tree: GroupTree, groupId: string, level: GroupLevel): string;
export declare function groupsRollingInto(tree: GroupTree, targetId: string, level: GroupLevel): string[];
export declare function treeSortKey(tree: GroupTree, groupId: string): string;
