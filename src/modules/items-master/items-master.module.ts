import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemExceptionFilter } from './item-exception.filter';
import { ItemsMasterController } from './items-master.controller';
import { ItemsMasterService } from './items-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsMasterController],
  providers: [ItemsMasterService, ItemExceptionFilter],
})
export class ItemsMasterModule {}
