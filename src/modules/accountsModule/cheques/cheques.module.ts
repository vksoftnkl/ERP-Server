import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { BillBalanceModule } from '../billBalance/bill-balance.module';
import { ChequesController } from './cheques.controller';
import { ChequesExceptionFilter } from './cheques-exception.filter';
import { ChequesService } from './cheques.service';
import { ChequeDepositService } from './cheque-deposit.service';
import { ChequeClearService } from './cheque-clear.service';
import { ChequeBounceService } from './cheque-bounce.service';
import { ChequeReissueService } from './cheque-reissue.service';
import { ChequeReturnService } from './cheque-return.service';

/**
 * Received cheques — menu 51.
 *
 * ── What it imports, and why ─────────────────────────────────────────────
 * `BillBalanceModule` for `BillBalanceRecomputeService`, the TypeScript
 * replacement for `fn_abl_recompute`. Every writer of `acc_bill_adjustment`
 * must call it — there is no trigger behind it — and this module is a writer
 * on four of its six paths.
 *
 * `AppSettingsModule` for the resolver. §2.2's two settings are read through
 * `fn_app_settings_effective` and never by querying `app_setting_value`, so
 * this screen and the settings screen cannot disagree about what is
 * configured.
 *
 * ── What it does NOT import ──────────────────────────────────────────────
 * `ReceiptModule`. Nothing here calls a receipt service: what is shared with
 * it is shared as pure functions and helpers reached by path —
 * `allocation-engine.ts`, `receipt.guards.ts`, `receipt.utils.ts`,
 * `receipt-enum.ts`, `voucher-totals.helper.ts`, `ledger-map.helper.ts`.
 * Importing the module would make the dependency circular the moment the
 * receipt wants to show a cheque's status on its own screen, and it would buy
 * nothing: a pure function needs no provider.
 *
 * `TenderDetailModule` for the same reason in reverse — this module never
 * WRITES a tender row. It reads the one the receipt wrote, to find out which
 * ledger a cheque was posted to (§5), and a read of one column does not need a
 * service.
 *
 * ── The one service-to-service call ──────────────────────────────────────
 * `ChequeReissueService` injects `ChequeReturnService`, because replacing a
 * HELD cheque IS returning it and then taking a new one (§4.6). Two copies of
 * a reversal would be two chances to get the post-dated mirror wrong.
 */
@Module({
  imports: [AppSettingsModule, BillBalanceModule],
  controllers: [ChequesController],
  providers: [
    ChequesService,
    ChequeDepositService,
    ChequeClearService,
    ChequeBounceService,
    ChequeReissueService,
    ChequeReturnService,
    ChequesExceptionFilter,
  ],
  exports: [ChequesService],
})
export class ChequesModule {}
