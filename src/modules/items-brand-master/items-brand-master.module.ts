import { Module } from '@nestjs/common';
import { ItemBrandExceptionFilter } from './item-brand-exception.filter';
import { ItemsBrandMasterController } from './items-brand-master.controller';
import { ItemsBrandMasterService } from './items-brand-master.service';

@Module({
  controllers: [ItemsBrandMasterController],
  providers: [ItemsBrandMasterService, ItemBrandExceptionFilter],
})
export class ItemsBrandMasterModule {}
