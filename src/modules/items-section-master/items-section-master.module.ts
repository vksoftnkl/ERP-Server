import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemSectionExceptionFilter } from './item-section-exception.filter';
import { ItemsSectionMasterController } from './items-section-master.controller';
import { ItemsSectionMasterService } from './items-section-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsSectionMasterController],
  providers: [ItemsSectionMasterService, ItemSectionExceptionFilter],
})
export class ItemsSectionMasterModule {}
