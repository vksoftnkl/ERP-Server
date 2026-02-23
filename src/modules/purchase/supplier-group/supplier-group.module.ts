import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { SupplierGroupController } from './supplier-group.controller';
import { SupplierGroupExceptionFilter } from './supplier-group-exception.filter';
import { SupplierGroupService } from './supplier-group.service';

@Module({
  imports: [AuditLogModule],
  controllers: [SupplierGroupController],
  providers: [SupplierGroupService, SupplierGroupExceptionFilter],
})
export class SupplierGroupModule {}
