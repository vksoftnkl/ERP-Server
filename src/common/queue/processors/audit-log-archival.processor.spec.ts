import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogArchivalJobData, AuditLogArchivalProcessor } from './audit-log-archival.processor';

const NOW = new Date('2026-10-23T10:00:00.000Z');

describe('AuditLogArchivalProcessor', () => {
  let findMany: jest.Mock;
  let deleteMany: jest.Mock;
  let processor: AuditLogArchivalProcessor;
  let log: jest.SpyInstance;

  const jobOf = (data: AuditLogArchivalJobData) =>
    ({ data, updateProgress: jest.fn(async () => undefined) }) as unknown as Job<
      AuditLogArchivalJobData
    > & { updateProgress: jest.Mock };

  /** findMany answers each batch in turn; deleteMany deletes what it was handed. */
  const batches = (...sizes: number[]) => {
    let next = 0;
    for (const size of sizes) {
      const start = next;
      findMany.mockResolvedValueOnce(
        Array.from({ length: size }, (_, i) => ({ logId: `log-${start + i}` })),
      );
      next += size;
    }
    findMany.mockResolvedValue([]);
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    findMany = jest.fn();
    deleteMany = jest.fn(async (args: { where: { logId: { in: string[] } } }) => ({
      count: args.where.logId.in.length,
    }));
    processor = new AuditLogArchivalProcessor({
      auditLog: { findMany, deleteMany },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
    log.mockRestore();
  });

  it('reads rows older than the cutoff, batch by batch', async () => {
    batches(0);

    await processor.process(jobOf({ olderThanDays: 30, batchSize: 10 }));

    expect(findMany).toHaveBeenCalledWith({
      where: { logDate: { lt: new Date('2026-09-23T10:00:00.000Z') } },
      select: { logId: true },
      take: 10,
    });
  });

  it('defaults the batch size to 1000', async () => {
    batches(0);

    await processor.process(jobOf({ olderThanDays: 365 }));

    expect(findMany.mock.calls[0][0].take).toBe(1000);
  });

  it('deletes by id and stops after a short batch', async () => {
    batches(3, 3, 2, 5);
    const job = jobOf({ olderThanDays: 1, batchSize: 3 });

    await expect(processor.process(job)).resolves.toEqual({ deleted: 8 });

    expect(deleteMany).toHaveBeenCalledTimes(3);
    expect(deleteMany.mock.calls[2][0]).toEqual({
      where: { logId: { in: ['log-6', 'log-7'] } },
    });
    expect(job.updateProgress.mock.calls.map((c) => c[0])).toEqual([3, 6, 8]);
  });

  it('stops when a full batch is followed by an empty read', async () => {
    batches(2);

    await expect(processor.process(jobOf({ olderThanDays: 1, batchSize: 2 }))).resolves.toEqual({
      deleted: 2,
    });

    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('deletes nothing when nothing is old enough', async () => {
    batches(0);
    const job = jobOf({ olderThanDays: 1 });

    await expect(processor.process(job)).resolves.toEqual({ deleted: 0 });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(job.updateProgress).not.toHaveBeenCalled();
  });

  it('stops when the delete removes fewer rows than it read', async () => {
    batches(3, 3);
    deleteMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      processor.process(jobOf({ olderThanDays: 1, batchSize: 3 })),
    ).resolves.toEqual({ deleted: 1 });

    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
