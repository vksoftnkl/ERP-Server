import { Prisma } from '@prisma/client';
export interface SummarySqlScope {
    companyId: string;
    branchId: string;
    from: string;
    to: string;
    openingAsOf: string;
    godownId: string | null;
    bucket: string | null;
    groupId: string | null;
    brandId: string | null;
    wot: boolean;
}
export declare function hasItemFilter(s: Pick<SummarySqlScope, 'groupId' | 'brandId'>): boolean;
export declare function passSql(s: SummarySqlScope): Prisma.Sql;
export interface PassPartRow {
    part: 'H' | 'O' | 'C';
    item: string;
    lot: string;
    godown: string;
    bucket: string;
    oq: Prisma.Decimal | null;
    pq: Prisma.Decimal | null;
    iq: Prisma.Decimal | null;
    xq: Prisma.Decimal | null;
    iv: Prisma.Decimal | null;
    xv: Prisma.Decimal | null;
    n: number | null;
    value: Prisma.Decimal | null;
    vm: string | null;
}
export declare function factsSql(itemIds: readonly string[]): Prisma.Sql;
export declare function lastSaleSql(s: Pick<SummarySqlScope, 'companyId' | 'branchId' | 'to'>, itemIds: readonly string[]): Prisma.Sql;
export declare function balanceNowSql(s: SummarySqlScope): Prisma.Sql;
export declare function rowsAfterSql(s: SummarySqlScope): Prisma.Sql;
export declare function transitNowSql(s: SummarySqlScope, dir: 'in' | 'out' | 'all'): Prisma.Sql;
export declare function transitReplaySql(s: SummarySqlScope, fromBranch: string | null): Prisma.Sql;
export declare function branchesNowSql(s: SummarySqlScope): Prisma.Sql;
export declare function branchesReplaySql(s: SummarySqlScope): Prisma.Sql;
export declare function companyBranchesSql(companyId: string): Prisma.Sql;
export declare function lotsNowSql(s: SummarySqlScope, itemId: string): Prisma.Sql;
export declare function lotNamesSql(lotIds: readonly string[], godownIds: readonly string[]): Prisma.Sql;
export declare function lastPurchaseSql(s: SummarySqlScope, itemId: string): Prisma.Sql;
export declare function bndNowSql(s: SummarySqlScope): Prisma.Sql;
