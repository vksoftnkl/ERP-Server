import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { type StockBalanceFinding } from '../../../modules/stocks/posting/stock-balance-assertion';
export interface StockReconciliationJobData {
    accYear?: string;
    companyId: string;
    branchId?: string;
    itemId?: string;
}
export interface StockReconciliationResult {
    findings: StockBalanceFinding[];
    byKind: Record<string, number>;
}
export declare class StockReconciliationProcessor extends WorkerHost {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    process(job: Job<StockReconciliationJobData>): Promise<StockReconciliationResult>;
}
