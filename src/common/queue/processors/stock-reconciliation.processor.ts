import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  assertStockBalances,
  type StockBalanceFinding,
} from '../../../modules/stocks/posting/stock-balance-assertion';
import { QUEUE_NAMES } from '../queue.constants';

export interface StockReconciliationJobData {
  /** Kept for the job's callers; the engine's balances are not per year. */
  accYear?: string;
  companyId: string;
  branchId?: string;
  itemId?: string;
}

export interface StockReconciliationResult {
  findings: StockBalanceFinding[];
  /** Findings per kind, for the log line and the dashboard. */
  byKind: Record<string, number>;
}

/**
 * §5.1 — the nightly BALANCE ASSERTION over the stock engine's tables.
 *
 * It replaced the reconciliation of `inventory.item_batch_stock` against
 * `inventory.item_stock_ledger` on 2026-09-28: those tables have 0 rows and no
 * writer, so the old job compared nothing to nothing and reported a clean book.
 *
 * DETECT AND REPORT, NEVER SILENTLY FIX: every derived figure (balance
 * accumulators, the branch item total, reserved, in transit, the lot total) is
 * re-derived from its source and every disagreement is returned and logged.
 * Repair is a separate, explicit act.
 */
@Processor(QUEUE_NAMES.STOCK_RECONCILIATION)
export class StockReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(StockReconciliationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<StockReconciliationJobData>): Promise<StockReconciliationResult> {
    const { companyId, branchId, itemId } = job.data;
    this.logger.log(
      `Stock balance assertion — company: ${companyId}` +
        (branchId ? `, branch: ${branchId}` : '') +
        (itemId ? `, item: ${itemId}` : ''),
    );
    const findings = await assertStockBalances(this.prisma, { companyId, branchId, itemId });
    const byKind: Record<string, number> = {};
    for (const f of findings) {
      byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    }
    if (findings.length > 0) {
      this.logger.warn(
        `Stock balance assertion found ${findings.length} disagreement(s): ` +
          Object.entries(byKind)
            .map(([kind, n]) => `${kind}=${n}`)
            .join(', '),
      );
      for (const f of findings.slice(0, 50)) {
        this.logger.warn(
          `  ${f.kind} item ${f.itemId} lot ${f.lotId ?? '-'} godown ${f.godownId ?? '-'} ${f.bucket ?? ''}: stored ${f.stored}, derived ${f.derived}`,
        );
      }
    } else {
      this.logger.log('Stock balance assertion: every derived figure agrees with its source.');
    }
    await job.updateProgress(100);
    return { findings, byKind };
  }
}
