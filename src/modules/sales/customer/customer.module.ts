import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { CustomerController } from './customer.controller';
import { CustomerExceptionFilter } from './customer-exception.filter';
import { CustomerService } from './customer.service';

@Module({
  imports: [AuditLogModule],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerExceptionFilter],
})
export class CustomerModule {}
