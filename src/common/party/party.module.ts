import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { PartyBalanceService } from './party-balance.service';
import { PartySyncService } from './party-sync.service';

/**
 * Party master rules P1 (Shared/Prathap/party/plan-party-master-rules.md): the pieces
 * the Customer (menu 10) and Supplier (menu 22) masters share — the GST type list
 * (party-gst-type.ts), the one field map (party-detail.map.ts), the sync of the other
 * role, the delete guard's balance and the read-time last billed (party-billed.ts).
 */
@Module({
  imports: [AuditLogModule],
  providers: [PartyBalanceService, PartySyncService],
  exports: [PartyBalanceService, PartySyncService],
})
export class PartyModule {}
