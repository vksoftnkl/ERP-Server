import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemEanCodeExceptionFilter } from './item-ean-code-exception.filter';
import { ItemsEanCodeMasterController } from './items-ean-code-master.controller';
import { ItemsEanCodeMasterService } from './items-ean-code-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsEanCodeMasterController],
  providers: [ItemsEanCodeMasterService, ItemEanCodeExceptionFilter],
})
export class ItemsEanCodeMasterModule {}
