import { Module } from '@nestjs/common';
import { ItemBrandExceptionFilter } from './item-brand-exception.filter';
import { ItemsBrandMasterController } from './items-brand-master.controller';
import { ItemsBrandMasterService } from './items-brand-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsBrandMasterController],
  providers: [ItemsBrandMasterService, ItemBrandExceptionFilter],
})
export class ItemsBrandMasterModule {}
