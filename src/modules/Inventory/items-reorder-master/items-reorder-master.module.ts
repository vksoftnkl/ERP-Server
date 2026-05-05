import { Module } from '@nestjs/common';
import { ItemReorderExceptionFilter } from './item-reorder-exception.filter';
import { ItemsReorderMasterController } from './items-reorder-master.controller';
import { ItemsReorderMasterService } from './items-reorder-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsReorderMasterController],
  providers: [ItemsReorderMasterService, ItemReorderExceptionFilter],
})
export class ItemsReorderMasterModule {}
