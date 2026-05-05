import { Module } from '@nestjs/common';
import { ItemCategoryExceptionFilter } from './item-category-exception.filter';
import { ItemsCategoryMasterController } from './items-category-master.controller';
import { ItemsCategoryMasterService } from './items-category-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsCategoryMasterController],
  providers: [ItemsCategoryMasterService, ItemCategoryExceptionFilter],
})
export class ItemsCategoryMasterModule {}
