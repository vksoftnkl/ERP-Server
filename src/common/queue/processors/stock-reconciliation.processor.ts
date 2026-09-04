import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { QUEUE_NAMES } from '../queue.constants';

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

@Processor(QUEUE_NAMES.STOCK_RECONCILIATION)
export class StockReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(StockReconciliationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<StockReconciliationJobData>): Promise<StockReconciliationResult> {
    const { accYear, companyId, branchId, itemId } = job.data;

    this.logger.log(
      `Starting stock reconciliation — year: ${accYear}, company: ${companyId}` +
        (branchId ? `, branch: ${branchId}` : '') +
        (itemId ? `, item: ${itemId}` : ''),
    );

    const batchStocks = await this.prisma.itemBatchStock.findMany({
      where: {
        ibsAccYear: accYear,
        ibsCompanyId: companyId,
        ...(branchId ? { ibsBranchId: branchId } : {}),
        ...(itemId ? { ibsItemId: itemId } : {}),
      },
      select: {
        ibsId: true,
        ibsItemId: true,
        ibsBranchId: true,
        ibsGodownId: true,
        ibsBatchId: true,
        ibsBatchNo: true,
        ibsStockBucket: true,
        ibsClosingQty: true,
      },
    });

    const mismatches: StockMismatch[] = [];

    for (let i = 0; i < batchStocks.length; i++) {
      const stock = batchStocks[i];

      // Net qty from ledger = SUM(stlBaseQty * stlStockEffect) for this scope
      const ledgerAgg = await this.prisma.itemStockLedger.aggregate({
        where: {
          stlAccYear: accYear,
          stlCompanyId: companyId,
          stlBranchId: stock.ibsBranchId,
          stlGodownId: stock.ibsGodownId,
          stlItemId: stock.ibsItemId,
          stlBatchId: stock.ibsBatchId,
        },
        _sum: { stlBaseQty: true },
      });

      const ledgerNetQty = Number(ledgerAgg._sum?.stlBaseQty ?? 0);
      const batchClosingQty = Number(stock.ibsClosingQty ?? 0);
      const delta = batchClosingQty - ledgerNetQty;

      if (Math.abs(delta) > 0.000001) {
        mismatches.push({
          ibsId: stock.ibsId,
          itemId: stock.ibsItemId,
          batchId: stock.ibsBatchId,
          branchId: stock.ibsBranchId,
          godownId: stock.ibsGodownId,
          stockBucket: stock.ibsStockBucket,
          batchClosingQty,
          ledgerNetQty,
          delta,
        });
      }

      if (i % 100 === 0) {
        await job.updateProgress(Math.round((i / batchStocks.length) * 100));
      }
    }

    if (mismatches.length > 0) {
      this.logger.warn(
        `Reconciliation found ${mismatches.length} mismatch(es) out of ${batchStocks.length} records`,
      );
    } else {
      this.logger.log(`Reconciliation complete. All ${batchStocks.length} records match.`);
    }

    return { checked: batchStocks.length, mismatches };
  }
}
