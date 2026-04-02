import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemGroupExceptionFilter } from './item-group-exception.filter';
import { ItemsGroupMasterController } from './items-group-master.controller';
import { ItemsGroupMasterService } from './items-group-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsGroupMasterController],
  providers: [ItemsGroupMasterService, ItemGroupExceptionFilter],
})
export class ItemsGroupMasterModule {}
