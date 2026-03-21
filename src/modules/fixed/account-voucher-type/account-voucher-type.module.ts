import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccountVoucherTypeController } from './account-voucher-type.controller';
import { AccountVoucherTypeExceptionFilter } from './account-voucher-type-exception.filter';
import { AccountVoucherTypeService } from './account-voucher-type.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AccountVoucherTypeController],
  providers: [AccountVoucherTypeService, AccountVoucherTypeExceptionFilter],
})
export class AccountVoucherTypeModule {}
