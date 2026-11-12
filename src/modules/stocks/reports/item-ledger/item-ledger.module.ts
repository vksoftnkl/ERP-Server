import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../../../settings/appSettings/app-settings.module';
import { ItemLedgerController } from './item-ledger.controller';
import { ItemLedgerService } from './item-ledger.service';

/**
 * stock/reports/item-ledger — Item Ledger, menu 301 (plan 2026-11-11). Read-only.
 *
 * AppSettingsModule: the walk-in customer (`sales.default_customer_id`) that
 * labels a counter bill "Counter (cash)" (D6). Prisma and the request context
 * are global; nothing here calls another module's route or DTO. The service is
 * exported for the print providers
 * (settings/print-render/data/providers/item-ledger.providers.ts), which call
 * its `export` so the paper is the report's own rows.
 */
@Module({
  imports: [AppSettingsModule],
  controllers: [ItemLedgerController],
  providers: [ItemLedgerService],
  exports: [ItemLedgerService],
})
export class ItemLedgerModule {}
