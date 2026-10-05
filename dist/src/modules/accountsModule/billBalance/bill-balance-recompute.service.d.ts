import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
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
    changed: boolean;
}
export declare class BillBalanceRecomputeService {
    private readonly prisma;
    private readonly requestContext;
    private readonly logger;
    constructor(prisma: PrismaService, requestContext: RequestContextService);
    recomputeBills(client: AccountsWriteClient, bills: readonly BillKey[], asOf?: Date): Promise<RecomputedBill[]>;
    private logTempCreditTransitions;
    regularisePostDated(scope: RegulariseScope, asOf?: Date, batchSize?: number): Promise<RegulariseResult>;
}
export interface RegulariseScope {
    companyId: string;
    branchId?: string | null;
    accYear?: string | null;
}
export interface RegulariseResult {
    asOf: string;
    billsRegularised: number;
    billsExamined: number;
}
