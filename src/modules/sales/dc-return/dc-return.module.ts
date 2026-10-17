import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { SalesPostingModule } from '../posting/posting.module';
import { DcReturnController } from './dc-return.controller';
import { DcReturnExceptionFilter } from './dc-return-exception.filter';
import { DcReturnService } from './dc-return.service';

@Module({
  imports: [AuditLogModule, ChargeDetailModule, TenderDetailModule, SalesPostingModule],
  controllers: [DcReturnController],
  providers: [DcReturnService, DcReturnExceptionFilter],
  exports: [DcReturnService],
})
export class DcReturnModule {}
