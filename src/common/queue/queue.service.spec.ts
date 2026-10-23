import type { Queue } from 'bullmq';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let archival: { add: jest.Mock };
  let reconciliation: { add: jest.Mock };
  let service: QueueService;

  beforeEach(() => {
    archival = { add: jest.fn(async () => ({ id: 'job-1' })) };
    reconciliation = { add: jest.fn(async () => ({ id: 'job-2' })) };
    service = new QueueService(archival as unknown as Queue, reconciliation as unknown as Queue);
  });

  describe('scheduleAuditLogArchival', () => {
    it('queues a year-old purge in batches of 1000 by default, retried 3 times', async () => {
      await expect(service.scheduleAuditLogArchival()).resolves.toBe('job-1');

      expect(archival.add).toHaveBeenCalledWith(
        'archival',
        { olderThanDays: 365, batchSize: 1000 },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    });

    it('passes the age and batch size through', async () => {
      await service.scheduleAuditLogArchival(90, 50);

      expect(archival.add.mock.calls[0][1]).toEqual({ olderThanDays: 90, batchSize: 50 });
    });

    it('answers an empty id when the queue gives none', async () => {
      archival.add.mockResolvedValue({});

      await expect(service.scheduleAuditLogArchival()).resolves.toBe('');
    });
  });

  describe('scheduleStockReconciliation', () => {
    it('queues the scope as given, retried twice 10 s apart', async () => {
      const data = { companyId: 'c1', branchId: 'b1', itemId: 'i1' };

      await expect(service.scheduleStockReconciliation(data)).resolves.toBe('job-2');

      expect(reconciliation.add).toHaveBeenCalledWith('reconcile', data, {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
      });
      expect(archival.add).not.toHaveBeenCalled();
    });

    it('answers an empty id when the queue gives none', async () => {
      reconciliation.add.mockResolvedValue({ id: undefined });

      await expect(service.scheduleStockReconciliation({ companyId: 'c1' })).resolves.toBe('');
    });
  });
});
