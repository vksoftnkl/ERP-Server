import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemReorderExceptionFilter } from './item-reorder-exception.filter';
import { ItemsReorderMasterController } from './items-reorder-master.controller';
import { ItemsReorderMasterService } from './items-reorder-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsReorderMasterController],
  providers: [ItemsReorderMasterService, ItemReorderExceptionFilter],
})
export class ItemsReorderMasterModule {}
