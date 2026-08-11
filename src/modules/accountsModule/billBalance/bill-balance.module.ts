import { Module } from '@nestjs/common';
import { BillBalanceService } from './bill-balance.service';

/**
 * Reads over accounts.acc_bill_balance. It owns no route of its own yet — the
 * credit summary is exposed by MasterLookupModule so the entry screens resolve
 * every per-party value from one base path — but the SQL lives here, because
 * the receipt and credit-note screens need the same outstanding figure and a
 * second copy of it would drift.
 */
@Module({
  providers: [BillBalanceService],
  exports: [BillBalanceService],
})
export class BillBalanceModule {}
