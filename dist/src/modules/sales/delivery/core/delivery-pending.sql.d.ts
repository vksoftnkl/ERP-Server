import { Prisma } from '@prisma/client';
export declare const WAITING_MODES_SQL: Prisma.Sql;
export declare const OPEN_STATUSES_SQL: Prisma.Sql;
export declare function eligibleLineWhere(b?: string, i?: string): Prisma.Sql;
export declare function eligibleLineExpr(b?: string, i?: string): Prisma.Sql;
export declare function lineFactorSql(i?: string, u?: string): Prisma.Sql;
export declare function lineUnitKgSql(i?: string, u?: string): Prisma.Sql;
export declare function lineEventSumsLateral(i?: string): Prisma.Sql;
export declare function pendingLinesCte(companyId: string, branchId: string, extra?: Prisma.Sql): Prisma.Sql;
