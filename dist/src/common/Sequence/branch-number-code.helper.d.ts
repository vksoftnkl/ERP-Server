import type { Prisma } from '@prisma/client';
export declare const BRANCH_NUMBER_CODE_PATTERN: RegExp;
export declare function branchNumberCode(tx: Prisma.TransactionClient, branchId: string): Promise<string | null>;
