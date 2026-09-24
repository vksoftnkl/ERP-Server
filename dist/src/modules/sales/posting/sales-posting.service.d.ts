import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { SalesLegSource, SalesPostingResult } from './types/sales-leg.types';
export declare class SalesPostingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    postLegs(tx: Prisma.TransactionClient, doc: SalesLegSource): Promise<SalesPostingResult>;
    retireForRestate(tx: Prisma.TransactionClient, voucherId: string, accYear: string, actor?: string): Promise<boolean>;
    private restateLegs;
    private insertLegs;
    reverseLegs(tx: Prisma.TransactionClient, voucherId: string, accYear: string, reason: string, actor?: string): Promise<{
        voucherId: string;
        legCount: number;
    } | null>;
    private resolveLegLedgers;
    private assertBalanced;
}
