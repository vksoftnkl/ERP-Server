import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { BillModule } from '../bill/bill.module';
import { SalesPostingModule } from '../posting/posting.module';
import { SaleOrderModule } from '../sale-order/sale-order.module';
import { DeliveryChallanController } from './delivery-challan.controller';
import { DeliveryChallanExceptionFilter } from './delivery-challan-exception.filter';
import { DeliveryChallanService } from './delivery-challan.service';

@Module({
  // SaleOrderModule: a challan draws its orders down (user 2026-11-17).
  imports: [
    AuditLogModule,
    ChargeDetailModule,
    TenderDetailModule,
    SalesPostingModule,
    BillModule,
    SaleOrderModule,
  ],
  controllers: [DeliveryChallanController],
  providers: [DeliveryChallanService, DeliveryChallanExceptionFilter],
  exports: [DeliveryChallanService],
})
export class DeliveryChallanModule {}
