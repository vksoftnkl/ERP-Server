import { Prisma } from '@prisma/client';
export interface LedgerSqlScope {
    companyId: string;
    branchId: string;
    itemId: string;
    from: string;
    to: string;
    godownId: string | null;
    bucket: string | null;
    lotId: string | null;
    wot: boolean;
    withRevaluations: boolean;
    types: string[];
    showReversed: boolean;
}
export declare function costValueCol(alias: string, wot: boolean): Prisma.Sql;
export declare function ledgerScopeWhere(alias: string, s: LedgerSqlScope): Prisma.Sql;
export declare function reportTypeCase(row: string, voucher: string, branchId: string): Prisma.Sql;
export declare function openingSql(s: LedgerSqlScope, withAfter: boolean): Prisma.Sql;
export declare function ledgerChain(s: LedgerSqlScope): Prisma.Sql;
export declare function pageSql(s: LedgerSqlScope, opts: {
    order: 'asc' | 'desc';
    limit: number;
    offset: number;
}): Prisma.Sql;
export declare function summarySql(s: LedgerSqlScope): Prisma.Sql;
export declare function periodSql(s: LedgerSqlScope, grain: 'day' | 'month'): Prisma.Sql;
export declare function stockNowSql(s: LedgerSqlScope): Prisma.Sql;
export declare function revaluationsLeftOutSql(s: LedgerSqlScope): Prisma.Sql;
export declare function optionTypesSql(companyId: string, branchId: string, itemId: string): Prisma.Sql;
