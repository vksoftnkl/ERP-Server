import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { CustomerGroupController } from './customer-group.controller';
import { CustomerGroupExceptionFilter } from './customer-group-exception.filter';
import { CustomerGroupService } from './customer-group.service';

@Module({
  imports: [AuditLogModule],
  controllers: [CustomerGroupController],
  providers: [CustomerGroupService, CustomerGroupExceptionFilter],
})
export class CustomerGroupModule {}
