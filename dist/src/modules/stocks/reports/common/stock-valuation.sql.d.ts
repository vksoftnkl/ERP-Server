import { Prisma } from '@prisma/client';
export interface PoolValuationOptions {
    holdings: string;
    prefix: string;
    companyId: string;
    asOf: string;
    wot: boolean;
}
export declare function poolValuationCtes(o: PoolValuationOptions): Prisma.Sql;
export interface ValuedHoldingRow {
    lot: string;
    godown: string;
    bucket: string;
    q: Prisma.Decimal;
    vm: string;
    rate: Prisma.Decimal;
    value: Prisma.Decimal;
}
export declare function itemValuationSql(s: {
    companyId: string;
    branchId: string;
    itemId: string;
    asOf: string;
    wot: boolean;
}): Prisma.Sql;
export declare function valueInScope(rows: readonly ValuedHoldingRow[], scope: {
    godownId: string | null;
    bucket: string | null;
    lotId: string | null;
}): {
    qty: Prisma.Decimal;
    value: Prisma.Decimal;
};
