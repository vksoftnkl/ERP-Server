import { Module } from '@nestjs/common';
import { LedgerStatementController } from './ledger-statement.controller';
import { LedgerStatementService } from './ledger-statement.service';

/**
 * reports/ledger-statement — the Ledger Statement (plan 2026-09-25). Read-only.
 *
 * Imports no other feature module on purpose (§2): Prisma and the request
 * context are global, and nothing here calls another module's service, route
 * or DTO.
 */
@Module({
  controllers: [LedgerStatementController],
  providers: [LedgerStatementService],
})
export class LedgerStatementModule {}
