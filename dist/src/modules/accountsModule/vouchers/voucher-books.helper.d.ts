import { Prisma } from '@prisma/client';
export interface VoucherBooksScope {
    companyId: string;
    accYear: string;
    ledgerIds: readonly (string | null | undefined)[];
}
export declare function assertVoucherBooksReconcile(tx: Prisma.TransactionClient, scope: VoucherBooksScope): Promise<void>;
