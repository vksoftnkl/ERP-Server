import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { ChargeCarryBasis, ChargeCarryProposal, ChargeCarryRow } from './types/charge-carry.types';
export declare class ChargeCarryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    propose(tx: Prisma.TransactionClient, order: {
        orderId: string;
        accYear: string;
    }, billLines: {
        srcLineId: string;
        taxableAmt: number;
    }[], opts?: {
        defaultBasis?: ChargeCarryBasis;
    }): Promise<ChargeCarryProposal[]>;
    consume(tx: Prisma.TransactionClient, rows: ChargeCarryRow[], opts?: {
        canOverride?: boolean;
    }): Promise<number>;
    release(tx: Prisma.TransactionClient, rows: ChargeCarryRow[]): Promise<number>;
    private move;
}
