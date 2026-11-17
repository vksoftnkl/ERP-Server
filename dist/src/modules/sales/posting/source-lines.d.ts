import { Prisma } from '@prisma/client';
export type SourceKind = 'SALES_ORDER' | 'DELIVERY_CHALLAN';
export interface SourceKeys {
    type: string;
    docId: string;
    accYear: string;
    lineNo: string;
    itemId: string;
}
export declare const DC_SOURCE_KEYS: SourceKeys;
export declare const BILL_SOURCE_KEYS: SourceKeys;
export declare function resolveSourceLines(tx: Prisma.TransactionClient, lines: readonly Record<string, unknown>[] | undefined, keys: SourceKeys, kinds: readonly SourceKind[]): Promise<{
    unresolved: number[];
    changed: number[];
}>;
