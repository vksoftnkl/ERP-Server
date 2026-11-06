import { Module } from '@nestjs/common';
import { BillBalanceModule } from '../accountsModule/billBalance/bill-balance.module';
import { AppSettingsModule } from '../settings/appSettings/app-settings.module';
import { MasterLookupController } from './master-lookup.controller';
import { MasterLookupService } from './master-lookup.service';
@Module({
  // The party-credit route is a thin delegation to the accounts module: the
  // lookup layer routes it, the owning module computes it. AppSettingsModule:
  // sales.apply_qty_prices for the item-price lookup's qty_slabs (plan 2026-11-05 §4.4).
  imports: [BillBalanceModule, AppSettingsModule],
  controllers: [MasterLookupController],
  providers: [MasterLookupService],
})
export class MasterLookupModule {}
