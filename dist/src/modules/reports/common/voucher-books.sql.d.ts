import { Prisma } from '@prisma/client';
export type Side = 'DR' | 'CR';
export interface SidedAmount {
    amount: string;
    side: Side;
}
export interface BooksScope {
    companyId: string;
    accYear: string;
    branchId: string | null;
}
export type LedgerFilter = {
    ledgerId: string;
} | {
    ledgerIds: readonly string[];
} | null;
export declare function countedLegsSql(scope: BooksScope, opts: {
    from?: string;
    upTo: string;
    ledgers: LedgerFilter;
}): Prisma.Sql;
export declare function openingSetSql(scope: BooksScope, ledgers: LedgerFilter): Prisma.Sql;
export declare function openingNoteSql(scope: BooksScope, ledgers: LedgerFilter): Prisma.Sql;
export declare function createdByJoinSql(column: string, alias: string): Prisma.Sql;
export declare function money(value: Prisma.Decimal | string | number | null | undefined): string;
export declare function sided(value: Prisma.Decimal | string | number | null | undefined): SidedAmount;
export declare function isoDate(value: Date): string;
