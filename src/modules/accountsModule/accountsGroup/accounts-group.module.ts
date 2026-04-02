import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccountGroupExceptionFilter } from './account-group-exception.filter';
import { AccountsGroupController } from './accounts-group.controller';
import { AccountsGroupService } from './accounts-group.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AccountsGroupController],
  providers: [AccountsGroupService, AccountGroupExceptionFilter],
})
export class AccountsGroupModule {}
