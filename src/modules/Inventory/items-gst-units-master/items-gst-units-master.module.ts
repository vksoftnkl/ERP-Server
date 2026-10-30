import { Module } from '@nestjs/common';
import { ItemGstUnitExceptionFilter } from './item-gst-unit-exception.filter';
import { ItemsGstUnitsMasterController } from './items-gst-units-master.controller';
import { ItemsGstUnitsMasterService } from './items-gst-units-master.service';

@Module({
  controllers: [ItemsGstUnitsMasterController],
  providers: [ItemsGstUnitsMasterService, ItemGstUnitExceptionFilter],
})
export class ItemsGstUnitsMasterModule {}
