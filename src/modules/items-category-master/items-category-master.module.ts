import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemCategoryExceptionFilter } from './item-category-exception.filter';
import { ItemsCategoryMasterController } from './items-category-master.controller';
import { ItemsCategoryMasterService } from './items-category-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsCategoryMasterController],
  providers: [ItemsCategoryMasterService, ItemCategoryExceptionFilter],
})
export class ItemsCategoryMasterModule {}
