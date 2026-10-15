import { Module } from '@nestjs/common';
import { PartyOutstandingController } from './party-outstanding.controller';
import { PartyOutstandingService } from './party-outstanding.service';

/**
 * reports/party-outstanding — Party-wise Outstanding (plan 2026-10-09). Read-only.
 *
 * Imports no other feature module on purpose (§2): Prisma and the request
 * context are global, and nothing here calls another module's service, route
 * or DTO. The service is exported for the print providers
 * (settings/print-render/data/providers/party-outstanding.providers.ts), which
 * call its `export` so the paper is the report's own rows.
 */
@Module({
  controllers: [PartyOutstandingController],
  providers: [PartyOutstandingService],
  exports: [PartyOutstandingService],
})
export class ReportsPartyOutstandingModule {}
