import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuditLogArchivalJobData } from './processors/audit-log-archival.processor';
import { StockReconciliationJobData } from './processors/stock-reconciliation.processor';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.AUDIT_LOG_ARCHIVAL)
    private readonly auditLogArchivalQueue: Queue<AuditLogArchivalJobData>,
    @InjectQueue(QUEUE_NAMES.STOCK_RECONCILIATION)
    private readonly stockReconciliationQueue: Queue<StockReconciliationJobData>,
  ) {}

  async scheduleAuditLogArchival(olderThanDays = 365, batchSize = 1000): Promise<string> {
    const job = await this.auditLogArchivalQueue.add(
      'archival',
      { olderThanDays, batchSize },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return job.id ?? '';
  }

  async scheduleStockReconciliation(data: StockReconciliationJobData): Promise<string> {
    const job = await this.stockReconciliationQueue.add('reconcile', data, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 10000 },
    });
    return job.id ?? '';
  }
}
