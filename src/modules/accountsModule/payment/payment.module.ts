import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TenderDetailModule } from '../tenderDetail/tender-detail.module';
import { BillBalanceModule } from '../billBalance/bill-balance.module';
import { PaymentController } from './payment.controller';
import { PaymentExceptionFilter } from './payment-exception.filter';
import { PaymentService } from './payment.service';
import { PaymentPostingService } from './payment-posting.service';
import { PaymentCancelService } from './payment-cancel.service';
import { PaymentAmendService } from './payment-amend.service';
import { PaymentOpenItemsService } from './payment-open-items.service';
import { TillModule } from '../../till/till.module';

/**
 * The payment (menu 100) — `ReceiptModule`, mirrored. The same four imports
 * for the same four reasons: the settings resolver, the one tender writer,
 * the audit log for `/amend`, and the bill recompute that owns the cached
 * totals. The allocation engine, the cheque-book helper, the ledger facts and
 * the posting helpers are plain imports from the receipt and voucher modules,
 * not copies.
 */
@Module({
  // TillModule: on a counter's device the money moves in the live till session (48).
  imports: [AppSettingsModule, TenderDetailModule, BillBalanceModule, AuditLogModule, TillModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentPostingService,
    PaymentCancelService,
    PaymentAmendService,
    PaymentOpenItemsService,
    PaymentExceptionFilter,
  ],
  exports: [PaymentOpenItemsService],
})
export class PaymentModule {}
