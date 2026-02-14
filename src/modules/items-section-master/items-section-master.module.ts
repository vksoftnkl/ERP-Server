import { Module } from '@nestjs/common';
import { ItemSectionExceptionFilter } from './item-section-exception.filter';
import { ItemsSectionMasterController } from './items-section-master.controller';
import { ItemsSectionMasterService } from './items-section-master.service';

@Module({
  controllers: [ItemsSectionMasterController],
  providers: [ItemsSectionMasterService, ItemSectionExceptionFilter],
})
export class ItemsSectionMasterModule {}
