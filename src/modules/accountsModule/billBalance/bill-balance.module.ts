import { Module } from '@nestjs/common';
import { BillBalanceService } from './bill-balance.service';
import { BillBalanceRecomputeService } from './bill-balance-recompute.service';

/**
 * Reads over accounts.acc_bill_balance. It owns no route of its own yet — the
 * credit summary is exposed by MasterLookupModule so the entry screens resolve
 * every per-party value from one base path — but the SQL lives here, because
 * the receipt and credit-note screens need the same outstanding figure and a
 * second copy of it would drift.
 */
@Module({
  providers: [BillBalanceService, BillBalanceRecomputeService],
  // BillBalanceRecomputeService is fn_abl_recompute and fn_abl_regularise_pdc
  // in TypeScript. It is exported because EVERY writer of
  // accounts.acc_bill_adjustment must call it in the same transaction — there
  // is no trigger behind it — and the payment voucher will need the same code.
  exports: [BillBalanceService, BillBalanceRecomputeService],
})
export class BillBalanceModule {}
