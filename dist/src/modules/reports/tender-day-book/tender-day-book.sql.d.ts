import { Prisma } from '@prisma/client';
export interface MoneyLinesScope {
    companyId: string;
    accYear: string;
    branchId: string | null;
    upTo: string;
    from: string | null;
    sessionId: string | null;
}
export declare function labelledMoneyLinesSql(scope: MoneyLinesScope): Prisma.Sql;
