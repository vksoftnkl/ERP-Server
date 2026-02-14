import { Module } from '@nestjs/common';
import { ItemGroupExceptionFilter } from './item-group-exception.filter';
import { ItemsGroupMasterController } from './items-group-master.controller';
import { ItemsGroupMasterService } from './items-group-master.service';

@Module({
  controllers: [ItemsGroupMasterController],
  providers: [ItemsGroupMasterService, ItemGroupExceptionFilter],
})
export class ItemsGroupMasterModule {}
