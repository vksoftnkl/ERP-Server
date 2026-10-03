import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { QUEUE_NAMES } from '../queue.constants';

export interface AuditLogArchivalJobData {
  olderThanDays: number;
  batchSize?: number;
}

@Processor(QUEUE_NAMES.AUDIT_LOG_ARCHIVAL)
export class AuditLogArchivalProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditLogArchivalProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AuditLogArchivalJobData>): Promise<{ deleted: number }> {
    const { olderThanDays, batchSize = 1000 } = job.data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    this.logger.log(
      `Archiving audit logs older than ${olderThanDays} days (before ${cutoff.toISOString()})`,
    );

    let totalDeleted = 0;
    let batch: number;

    do {
      const rows = await this.prisma.auditLog.findMany({
        where: { logDate: { lt: cutoff } },
        select: { logId: true },
        take: batchSize,
      });

      if (rows.length === 0) break;

      const ids = rows.map((r) => r.logId);
      const result = await this.prisma.auditLog.deleteMany({
        where: { logId: { in: ids } },
      });

      batch = result.count;
      totalDeleted += batch;
      await job.updateProgress(totalDeleted);

      this.logger.log(`Deleted batch of ${batch} records (total: ${totalDeleted})`);
    } while (batch === batchSize);

    this.logger.log(`Audit log archival complete. Total deleted: ${totalDeleted}`);
    return { deleted: totalDeleted };
  }
}
