import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { SalesPostingModule } from '../posting/posting.module';
import { SaleOrderModule } from '../sale-order/sale-order.module';
import { SaleOrderDeskController } from './sale-order-desk.controller';
import { SaleOrderDeskExceptionFilter } from './sale-order-desk-exception.filter';
import { SaleOrderDeskMergeService } from './sale-order-desk-merge.service';
import { SaleOrderDeskService } from './sale-order-desk.service';

/**
 * Sales Order Management — the order desk (menu 299), its own route family
 * `/sale-order-desk/*` (D5). The order's own services come from
 * SaleOrderModule (SaleOrderService, SaleOrderLifecycleService), the
 * reservations and the rights from SalesPostingModule.
 */
@Module({
  imports: [AuditLogModule, SalesPostingModule, SaleOrderModule],
  controllers: [SaleOrderDeskController],
  providers: [SaleOrderDeskService, SaleOrderDeskMergeService, SaleOrderDeskExceptionFilter],
})
export class SaleOrderDeskModule {}
