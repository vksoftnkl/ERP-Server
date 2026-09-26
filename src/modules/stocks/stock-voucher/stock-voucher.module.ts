import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { StockPostingModule } from '../posting/stock-posting.module';
import { StockVoucherExceptionFilter } from './stock-voucher-exception.filter';
import { StockVoucherService } from './stock-voucher.service';

/**
 * No controller and no routes by design.
 *
 * stock.stock_voucher serves eleven document types, and each one gets its OWN
 * controller so the voucher type is pinned by the route rather than carried in
 * a payload. This module owns the type-agnostic half — save, load, list,
 * preflight, post, cancel, delete — and exports it; OpeningStockVoucherModule
 * imports it today and the next five screens import the same one.
 */
@Module({
  imports: [AuditLogModule, StockPostingModule],
  providers: [StockVoucherService, StockVoucherExceptionFilter],
  exports: [StockVoucherService, StockVoucherExceptionFilter],
})
export class StockVoucherModule {}
