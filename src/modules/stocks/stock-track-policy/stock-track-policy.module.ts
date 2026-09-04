import { Module } from '@nestjs/common';
import { StockTrackPolicyService } from './stock-track-policy.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
/**
 * No controller and no routes by design. stock.stock_track_policy is written
 * as a consequence of saving an item, not through an API of its own — see
 * StockTrackPolicyService.syncFromItem and ItemsMasterService.
 */
@Module({
  imports: [AuditLogModule],
  providers: [StockTrackPolicyService],
  exports: [StockTrackPolicyService],
})
export class StockTrackPolicyModule {}