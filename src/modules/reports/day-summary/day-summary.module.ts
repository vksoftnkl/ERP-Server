import { Module } from '@nestjs/common';
import { DaySummaryController } from './day-summary.controller';
import { DaySummaryService } from './day-summary.service';

/**
 * reports/day-summary — the Account Day Summary / day book (plan 2026-10-12).
 * Read-only.
 *
 * Imports no other feature module on purpose (§2): Prisma and the request
 * context are global, and nothing here calls another module's service, route
 * or DTO. The balance fragments it shares with the Ledger Statement live in
 * ../common/voucher-books.sql.ts (D1).
 */
@Module({
  controllers: [DaySummaryController],
  providers: [DaySummaryService],
})
export class DaySummaryModule {}
