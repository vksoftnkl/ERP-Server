import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { SaleOrderLineRef } from '../sale-order/types/sale-order-api.types';
export declare class DcFulfilmentService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    dcRefsOfBill(tx: Prisma.TransactionClient, sbId: string, sbAccYear: string): Promise<{
        dcId: string;
        accYear: string;
    }[]>;
    dcRefsOfLines(tx: Prisma.TransactionClient, sdiIds: readonly string[]): Promise<{
        dcId: string;
        accYear: string;
    }[]>;
    orderRefsOfDcLines(tx: Prisma.TransactionClient, sdiIds: readonly string[]): Promise<SaleOrderLineRef[]>;
    recompute(tx: Prisma.TransactionClient, refs: readonly {
        dcId: string;
        accYear: string;
    }[], actor: string, now: Date): Promise<void>;
    private recomputeOne;
}
