import { Prisma } from '@prisma/client';
export type MenuRight = 'view' | 'create' | 'edit' | 'delete' | 'print' | 'export' | 'post' | 'cancel' | 'amend' | 'override' | 'retender';
export type MenuRights = Record<MenuRight, boolean>;
export declare const NO_RIGHTS: Readonly<MenuRights>;
export declare const RIGHT_COLUMN: Record<MenuRight, string>;
type RightsClient = Pick<Prisma.TransactionClient, '$queryRaw'>;
export declare function loadRights(client: RightsClient, userId: string, menuId: number): Promise<MenuRights>;
export {};
