import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { TenderDetailModule } from '../tenderDetail/tender-detail.module';
import { BillBalanceModule } from '../billBalance/bill-balance.module';
import { ReceiptController } from './receipt.controller';
import { ReceiptExceptionFilter } from './receipt-exception.filter';
import { ReceiptService } from './receipt.service';
import { ReceiptPostingService } from './receipt-posting.service';
import { ReceiptCancelService } from './receipt-cancel.service';
import { OpenItemsService } from './open-items.service';

/**
 * The receipt.
 *
 * ── What it imports, and why ─────────────────────────────────────────────
 * `AppSettingsModule` for the resolver — §2.8's seven settings are read through
 * `fn_app_settings_effective` and never by querying `app_setting_value`, so the
 * receipt screen and the settings screen cannot disagree about what is
 * configured.
 *
 * `TenderDetailModule` so the tender rows are written by the same service the
 * sale bill writes them with, under the same guards and the same audit trail —
 * a second writer would be a second definition of a cheque.
 *
 * `BillBalanceModule` for `BillBalanceRecomputeService`, which is the
 * TypeScript replacement for `fn_abl_recompute` and the trigger that used to
 * call it. It lives there rather than here because a bill's cached totals
 * belong to the bill, and the payment voucher will need exactly the same code.
 *
 * ── What it exports ──────────────────────────────────────────────────────
 * `OpenItemsService`, because `/transactions/party-balance` calls
 * `loadCredits` rather than keeping a SELECT of its own (§12).
 */
@Module({
  imports: [AppSettingsModule, TenderDetailModule, BillBalanceModule],
  controllers: [ReceiptController],
  providers: [
    ReceiptService,
    ReceiptPostingService,
    ReceiptCancelService,
    OpenItemsService,
    ReceiptExceptionFilter,
  ],
  exports: [OpenItemsService],
})
export class ReceiptModule {}
