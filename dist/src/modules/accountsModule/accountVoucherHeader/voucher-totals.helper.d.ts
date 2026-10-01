import { Prisma } from '@prisma/client';
import type { AccountsWriteClient } from "../../../common/utils/module-service.utils";
export interface VoucherTotals {
    totalDebit: Prisma.Decimal;
    totalCredit: Prisma.Decimal;
    difference: Prisma.Decimal;
}
export declare function deriveVoucherTotals(client: AccountsWriteClient, voucherId: string, accYear: string): Promise<VoucherTotals>;
