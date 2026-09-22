import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StatutoryService } from './statutory.service';
import type { LocksBlock, PostingBlock } from './types/posting.types';
export interface DocPostingFacts {
    status: string;
    companyId: string;
    branchId: string;
    accYear: string;
    docDate: string;
    voucherId: string | null;
    registerId: string | null;
    cogsAmt: number;
    loyaltyEarned?: number;
    loyaltyRedeemed?: number;
    returns?: number;
    allocations?: number;
    amendable?: boolean;
}
interface GstRows {
    irn: PostingBlock['irn'];
    ewb: PostingBlock['ewb'];
    irnGeneratedOn: Date | null;
    ewbGeneratedOn: Date | null;
    ewbValidUpto: Date | null;
}
export declare class SalesDocBlocksService {
    private readonly prisma;
    private readonly statutory;
    constructor(prisma: PrismaService, statutory: StatutoryService);
    build(facts: DocPostingFacts, client?: Prisma.TransactionClient): Promise<{
        posting: PostingBlock;
        locks: LocksBlock;
    }>;
    gstRows(c: Prisma.TransactionClient, gdrId: string | null, accYear: string): Promise<GstRows>;
    private voucher;
}
export {};
