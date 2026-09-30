import { Prisma } from '@prisma/client';
export interface MasterTree {
    table: string;
    id: string;
    parent: string;
    level: string;
    deleted: string;
    name: string;
    label: string;
    parentField: string;
    idField: string;
}
export declare const ITEM_GROUP_TREE: MasterTree;
export declare const ITEM_BRAND_TREE: MasterTree;
export declare const ITEM_SECTION_TREE: MasterTree;
export declare const ITEM_CATEGORY_TREE: MasterTree;
export declare const GODOWN_TREE: MasterTree;
export interface LiveReference {
    table: string;
    column: string;
    live: string;
    label: string;
}
export declare const ROOT_LEVEL = 1;
type RawClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
export declare function assertNotUnderOwnSubtree(client: RawClient, tree: MasterTree, nodeId: string, newParentId: string | null | undefined): Promise<void>;
export declare function relevelSubtree(client: RawClient, tree: MasterTree, nodeId: string): Promise<void>;
export declare function assertNoLiveChildren(client: RawClient, tree: MasterTree, nodeId: string): Promise<void>;
export declare function assertParentLive(client: RawClient, tree: MasterTree, parentId: string | null): Promise<void>;
export declare function countLiveReferences(client: RawClient, references: readonly LiveReference[], id: string): Promise<Array<{
    label: string;
    count: number;
}>>;
export declare function assertNoLiveReferences(client: RawClient, references: readonly LiveReference[], id: string, what: {
    label: string;
    idField: string;
}): Promise<void>;
export declare function assertDeleteState(isDeleted: boolean, wantDeleted: boolean, what: {
    label: string;
    idField: string;
    restoreRoute: string;
}): void;
export {};
