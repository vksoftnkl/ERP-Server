import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemBrandExceptionFilter } from './item-brand-exception.filter';
import { ItemsBrandMasterController } from './items-brand-master.controller';
import { ItemsBrandMasterService } from './items-brand-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsBrandMasterController],
  providers: [ItemsBrandMasterService, ItemBrandExceptionFilter],
})
export class ItemsBrandMasterModule {}
