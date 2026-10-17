import { Module } from '@nestjs/common';
import { SalesPostingModule } from '../../sales/posting/posting.module';
import { LoyaltyStatusController } from './loyalty-status.controller';
import { LoyaltyStatusService } from './loyalty-status.service';

/**
 * reports/loyalty-status — Loyalty Status, menu 79 (plan 2026-10-05). Read-only.
 *
 * Shaped like reports/ledger-statement: own routes, DTOs and payloads, and no
 * other module's route is called. The one import is `SalesPostingModule`, for
 * `LoyaltyLedgerService.redeemable()` — the single-member card (§5.3) reads
 * the till's own number rather than a copy of its WHERE clause (D1 a). The
 * two write actions of the screen live in sales/loyalty/members, not here.
 */
@Module({
  imports: [SalesPostingModule],
  controllers: [LoyaltyStatusController],
  providers: [LoyaltyStatusService],
})
export class LoyaltyStatusModule {}
