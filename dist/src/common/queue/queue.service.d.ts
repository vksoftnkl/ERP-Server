import { Queue } from 'bullmq';
import { AuditLogArchivalJobData } from './processors/audit-log-archival.processor';
import { StockReconciliationJobData } from './processors/stock-reconciliation.processor';
export declare class QueueService {
    private readonly auditLogArchivalQueue;
    private readonly stockReconciliationQueue;
    constructor(auditLogArchivalQueue: Queue<AuditLogArchivalJobData>, stockReconciliationQueue: Queue<StockReconciliationJobData>);
    scheduleAuditLogArchival(olderThanDays?: number, batchSize?: number): Promise<string>;
    scheduleStockReconciliation(data: StockReconciliationJobData): Promise<string>;
}
