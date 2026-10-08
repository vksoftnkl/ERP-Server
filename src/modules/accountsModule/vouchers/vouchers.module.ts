import { Module } from '@nestjs/common';
import { CommonPostingModule } from '../../../common/posting/posting.module';
import { BillBalanceModule } from '../billBalance/bill-balance.module';
import { TenderDetailModule } from '../tenderDetail/tender-detail.module';
import { VouchersController } from './vouchers.controller';
import { VouchersExceptionFilter } from './vouchers-exception.filter';
import { VoucherTypesService } from './voucher-types.service';
import { VoucherLookupsService } from './voucher-lookups.service';
import { VoucherRegisterService } from './voucher-register.service';
import { VoucherCancelService } from './voucher-cancel.service';

/**
 * The Voucher Register (voucher_register.md).
 *
 * `CommonPostingModule` for the ONE posting routine's pieces — the leg
 * writer (`VoucherPostingService.postLegs` / `reverseLegs`) and the GST
 * register writer (`DocRegisterService`). `BillBalanceModule` for the
 * recompute every writer of acc_bill_adjustment must call.
 */
@Module({
  // notes (54): the tender rows behind a Receipt Voucher's instruments are
  // written by the same service the receipt and the sale bill write them with.
  imports: [CommonPostingModule, BillBalanceModule, TenderDetailModule],
  controllers: [VouchersController],
  providers: [
    VoucherTypesService,
    VoucherLookupsService,
    VoucherRegisterService,
    VoucherCancelService,
    VouchersExceptionFilter,
  ],
  exports: [VoucherTypesService, VoucherRegisterService],
})
export class VouchersModule {}
