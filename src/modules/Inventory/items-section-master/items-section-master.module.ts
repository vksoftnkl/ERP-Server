import { Module } from '@nestjs/common';
import { ItemSectionExceptionFilter } from './item-section-exception.filter';
import { ItemsSectionMasterController } from './items-section-master.controller';
import { ItemsSectionMasterService } from './items-section-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsSectionMasterController],
  providers: [ItemsSectionMasterService, ItemSectionExceptionFilter],
})
export class ItemsSectionMasterModule {}
