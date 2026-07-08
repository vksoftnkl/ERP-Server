import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { QuotationController } from './quotation.controller';
import { QuotationExceptionFilter } from './quotation-exception.filter';
import { QuotationService } from './quotation.service';

@Module({
  imports: [AuditLogModule],
  controllers: [QuotationController],
  providers: [QuotationService, QuotationExceptionFilter],
  exports: [QuotationService],
})
export class QuotationModule {}
