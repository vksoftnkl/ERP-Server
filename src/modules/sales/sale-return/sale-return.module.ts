import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { SalesPostingModule } from '../posting/posting.module';
import { SaleReturnController } from './sale-return.controller';
import { SaleReturnExceptionFilter } from './sale-return-exception.filter';
import { SaleReturnService } from './sale-return.service';

@Module({
  imports: [AuditLogModule, ChargeDetailModule, TenderDetailModule, SalesPostingModule],
  controllers: [SaleReturnController],
  providers: [SaleReturnService, SaleReturnExceptionFilter],
  exports: [SaleReturnService],
})
export class SaleReturnModule {}
