import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
export interface AuditLogArchivalJobData {
    olderThanDays: number;
    batchSize?: number;
}
export declare class AuditLogArchivalProcessor extends WorkerHost {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    process(job: Job<AuditLogArchivalJobData>): Promise<{
        deleted: number;
    }>;
}
