import { Module } from '@nestjs/common';
import { BillBalanceModule } from '../accountsModule/billBalance/bill-balance.module';
import { MasterLookupController } from './master-lookup.controller';
import { MasterLookupService } from './master-lookup.service';
@Module({
  // The party-credit route is a thin delegation to the accounts module: the
  // lookup layer routes it, the owning module computes it.
  imports: [BillBalanceModule],
  controllers: [MasterLookupController],
  providers: [MasterLookupService],
})
export class MasterLookupModule {}
