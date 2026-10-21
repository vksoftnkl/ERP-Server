import { Prisma } from '@prisma/client';
type ReadClient = Pick<Prisma.TransactionClient, 'itemMaster' | 'itemUnitConversion'>;
export declare function assertItemsLive(client: ReadClient, itemIds: readonly string[], what: {
    field: string;
    code: string;
}): Promise<void>;
export declare function assertUnitOfItem(client: ReadClient, iucId: string, itemId: string, what: {
    field: string;
    code: string;
}): Promise<void>;
export declare function assertChildDeletable(client: ReadClient, row: {
    isDeleted: boolean;
    itemId: string;
}, what: {
    label: string;
    idField: string;
    alreadyDeletedCode: string;
    itemNotLiveCode: string;
}): Promise<void>;
export {};
