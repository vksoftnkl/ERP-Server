import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { SalesPostingModule } from '../posting/posting.module';
import { SaleOrderModule } from '../sale-order/sale-order.module';
import { DcReturnController } from './dc-return.controller';
import { DcReturnExceptionFilter } from './dc-return-exception.filter';
import { DcReturnService } from './dc-return.service';

@Module({
  // SaleOrderModule: a DC return re-opens its orders (user 2026-11-17).
  imports: [AuditLogModule, ChargeDetailModule, TenderDetailModule, SalesPostingModule, SaleOrderModule],
  controllers: [DcReturnController],
  providers: [DcReturnService, DcReturnExceptionFilter],
  exports: [DcReturnService],
})
export class DcReturnModule {}
