import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { BankListController } from './bank-list.controller';
import { BankListExceptionFilter } from './bank-list-exception.filter';
import { BankListService } from './bank-list.service';

@Module({
  imports: [AuditLogModule],
  controllers: [BankListController],
  providers: [BankListService, BankListExceptionFilter],
})
export class BankListModule {}
