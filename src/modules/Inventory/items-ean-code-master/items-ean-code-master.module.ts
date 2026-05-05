import { Module } from '@nestjs/common';
import { ItemEanCodeExceptionFilter } from './item-ean-code-exception.filter';
import { ItemsEanCodeMasterController } from './items-ean-code-master.controller';
import { ItemsEanCodeMasterService } from './items-ean-code-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsEanCodeMasterController],
  providers: [ItemsEanCodeMasterService, ItemEanCodeExceptionFilter],
})
export class ItemsEanCodeMasterModule {}
