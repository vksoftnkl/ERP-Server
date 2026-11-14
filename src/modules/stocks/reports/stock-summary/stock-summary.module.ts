import { Module } from '@nestjs/common';
import { StockSummaryController } from './stock-summary.controller';
import { StockSummaryRunStore } from './stock-summary-run.store';
import { StockSummaryService } from './stock-summary.service';

/**
 * stock/reports/summary — Stock Summary, menu 302 (plan 2026-11-13). Read-only.
 *
 * The run store is a singleton of this module (process memory, D20). Prisma
 * and the request context are global. The service is exported for the print
 * providers (settings/print-render/data/providers/stock-summary.providers.ts),
 * which read a run by id or have one built, so the paper is the screen's rows.
 */
@Module({
  controllers: [StockSummaryController],
  providers: [StockSummaryService, StockSummaryRunStore],
  exports: [StockSummaryService],
})
export class StockSummaryModule {}
