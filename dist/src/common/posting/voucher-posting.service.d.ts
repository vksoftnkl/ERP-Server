import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { VoucherLegSource, VoucherPostingResult } from './voucher-leg.types';
export declare class VoucherPostingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    postLegs(tx: Prisma.TransactionClient, doc: VoucherLegSource): Promise<VoucherPostingResult>;
    retireForRestate(tx: Prisma.TransactionClient, voucherId: string, accYear: string, actor?: string): Promise<boolean>;
    private restateLegs;
    private postIntoDraft;
    private insertLegs;
    reverseLegs(tx: Prisma.TransactionClient, voucherId: string, accYear: string, reason: string, actor?: string): Promise<{
        voucherId: string;
        legCount: number;
    } | null>;
    private reversalVoucherTypeId;
    private resolveLegLedgers;
    private assertBalanced;
}
