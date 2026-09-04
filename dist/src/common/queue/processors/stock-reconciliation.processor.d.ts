import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
export interface StockReconciliationJobData {
    accYear: string;
    companyId: string;
    branchId?: string;
    itemId?: string;
}
export interface StockMismatch {
    ibsId: string;
    itemId: string;
    batchId: string;
    branchId: string;
    godownId: string;
    stockBucket: string;
    batchClosingQty: number;
    ledgerNetQty: number;
    delta: number;
}
export interface StockReconciliationResult {
    checked: number;
    mismatches: StockMismatch[];
}
export declare class StockReconciliationProcessor extends WorkerHost {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    process(job: Job<StockReconciliationJobData>): Promise<StockReconciliationResult>;
}
