import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { AccountsWriteClient } from "../../../common/utils/module-service.utils";
export interface BillKey {
    billId: string;
    accYear: string;
}
export interface RecomputedBill extends BillKey {
    billAmount: Prisma.Decimal;
    allocAmount: Prisma.Decimal;
    discAmount: Prisma.Decimal;
    writeoffAmount: Prisma.Decimal;
    pendingAmount: Prisma.Decimal;
    settledOn: Date | null;
}
export declare class BillBalanceRecomputeService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    recomputeBills(client: AccountsWriteClient, bills: readonly BillKey[], asOf?: Date): Promise<RecomputedBill[]>;
    regularisePostDated(asOf?: Date, batchSize?: number): Promise<{
        asOf: string;
        billsRegularised: number;
    }>;
}
