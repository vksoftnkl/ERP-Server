import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { SaleOrderController } from './sale-order.controller';
import { SaleOrderExceptionFilter } from './sale-order-exception.filter';
import { SaleOrderService } from './sale-order.service';
@Module({
  // ChargeDetailModule / TenderDetailModule export the services that own the
  // order's applied charge lines (txn_charge_detail) and its tendered amounts
  // (acc_tender_detail). The advance allocations (sale_order_advance_alloc)
  // are owned by SaleOrderService itself.
  imports: [AuditLogModule, ChargeDetailModule, TenderDetailModule],
  controllers: [SaleOrderController],
  providers: [SaleOrderService, SaleOrderExceptionFilter],
  exports: [SaleOrderService],
})
export class SaleOrderModule {}