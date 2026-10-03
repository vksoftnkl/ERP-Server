import { Module } from '@nestjs/common';
import { BillBalanceModule } from '../billBalance/bill-balance.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { ChequeBooksController, IssuedChequesController } from './issued-cheques.controller';
import { IssuedChequesExceptionFilter } from './issued-cheques-exception.filter';
import { IssuedChequesService } from './issued-cheques.service';
import { ChequeBooksService } from './cheque-books.service';

/**
 * notes (55) — Issued Cheques (menu 52) and our cheque books (menu 263, notes 58).
 *
 * `VouchersModule` for `VoucherRegisterService.postWithin`: a replacement
 * cheque is a new Payment Voucher raised by the one posting routine, inside
 * the transaction that marks the old cheque REPLACED. `BillBalanceModule` for
 * the recompute every writer of acc_bill_adjustment must call. The received
 * side's helpers (cheques/*) are reached by path as pure functions, as that
 * module's own README asks.
 */
@Module({
  imports: [VouchersModule, BillBalanceModule],
  controllers: [IssuedChequesController, ChequeBooksController],
  providers: [IssuedChequesService, ChequeBooksService, IssuedChequesExceptionFilter],
})
export class IssuedChequesModule {}
