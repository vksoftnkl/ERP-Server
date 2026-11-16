import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { SalesPostingModule } from '../posting/posting.module';
import { SaleReturnController } from './sale-return.controller';
import { SaleReturnExceptionFilter } from './sale-return-exception.filter';
import { SaleReturnService } from './sale-return.service';
import { TillModule } from '../../till/till.module';
import { DeliveryCoreModule } from '../delivery/core/delivery-core.module';

@Module({
  // TillModule: a cash refund leaves TODAY's drawer (TILL_DESIGN.md D7).
  // DeliveryCoreModule: goods never taken settle the bill line's pending (delivery tracking §8.4 item 9).
  imports: [
    AuditLogModule,
    ChargeDetailModule,
    TenderDetailModule,
    SalesPostingModule,
    TillModule,
    DeliveryCoreModule,
  ],
  controllers: [SaleReturnController],
  providers: [SaleReturnService, SaleReturnExceptionFilter],
  exports: [SaleReturnService],
})
export class SaleReturnModule {}
