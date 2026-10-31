import { Prisma } from '@prisma/client';
import { type BooksScope } from '../common/voucher-books.sql';
export interface DsSqlScope extends BooksScope {
    from: string;
    to: string;
    voucherTypeId: number | null;
}
export type PairRule = 'RANGE' | 'DAY';
export declare function coreCtes(s: DsSqlScope, rule: PairRule): Prisma.Sql;
export declare function draftsSql(s: DsSqlScope): Prisma.Sql;
export declare function leglessSql(s: DsSqlScope): Prisma.Sql;
export declare const GAP_SPAN_CAP = 100000;
export declare function numberGapsSql(s: DsSqlScope): Prisma.Sql;
