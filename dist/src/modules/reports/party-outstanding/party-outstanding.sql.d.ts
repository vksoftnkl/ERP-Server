import { Prisma } from '@prisma/client';
import type { AgeBy, OutstandingSide } from './types/party-outstanding.types';
export declare const SUNDRY_DEBTORS_GROUP_ID = "019eee86-f34b-7ddc-91e2-efca49e5e8e8";
export declare const SUNDRY_CREDITORS_GROUP_ID = "019eee86-f34b-7d73-8a79-f5c6f036439a";
export interface SqlScope {
    companyId: string;
    asOn: string;
    today: string;
    fyName: string;
    branchId: string | null;
    side: OutstandingSide;
    owedSide: 'DR' | 'CR';
    traType: 'R' | 'P';
    group: {
        groupId: string;
        rootRole: boolean;
    } | null;
    areaId: string | null;
    salesmanId: string | null;
    collectionDay: number | null;
    partyId: string | null;
    ageBy: AgeBy;
    edges: number[];
    includeOnAccount: boolean;
    onlyOverdue: boolean;
    minDueDays: number | null;
    maxDueDays: number | null;
    deductPdc: boolean;
    hideZero: boolean;
}
export declare function bucketColumns(scope: SqlScope): string[];
export declare function hasDueFilter(scope: SqlScope): boolean;
export declare function billsWith(s: SqlScope, billLevel: boolean): Prisma.Sql;
export declare function partiesWith(s: SqlScope): Prisma.Sql;
export declare function partyTotalsCte(s: SqlScope): Prisma.Sql;
export declare function branchSummarySql(s: SqlScope): Prisma.Sql;
export declare function ledgerClosingSql(s: Pick<SqlScope, 'companyId' | 'fyName' | 'asOn' | 'branchId'>, ledgerId: string): Prisma.Sql;
