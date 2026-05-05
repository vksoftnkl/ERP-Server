import { Module } from '@nestjs/common';
import { ItemExceptionFilter } from './item-exception.filter';
import { ItemsMasterController } from './items-master.controller';
import { ItemsMasterService } from './items-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
@Module({
  imports: [AuditLogModule],
  controllers: [ItemsMasterController],
  providers: [ItemsMasterService, ItemExceptionFilter],
})
export class ItemsMasterModule {}
