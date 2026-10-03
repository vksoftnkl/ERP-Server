import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
export declare class DcFulfilmentService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    dcRefsOfBill(tx: Prisma.TransactionClient, sbId: string, sbAccYear: string): Promise<{
        dcId: string;
        accYear: string;
    }[]>;
    recompute(tx: Prisma.TransactionClient, refs: readonly {
        dcId: string;
        accYear: string;
    }[], actor: string, now: Date): Promise<void>;
    private recomputeOne;
}
