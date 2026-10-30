import { Module } from '@nestjs/common';
import { SalesPostingModule } from '../../posting/posting.module';
import { LoyaltyMembersController } from './loyalty-members.controller';
import { LoyaltyMembersService } from './loyalty-members.service';

/**
 * sales/loyalty/members — the Loyalty Status screen's two actions (plan
 * 2026-10-05 §7) and the status trail. Every ledger movement goes through
 * `LoyaltyLedgerService`, hence the posting module import.
 */
@Module({
  imports: [SalesPostingModule],
  controllers: [LoyaltyMembersController],
  providers: [LoyaltyMembersService],
})
export class LoyaltyMembersModule {}
