import { Module } from '@nestjs/common';
import { WidgetMasterController } from './widget-master.controller';
import { WidgetMasterExceptionFilter } from './widget-master-exception.filter';
import { WidgetMasterService } from './widget-master.service';

@Module({
  controllers: [WidgetMasterController],
  providers: [WidgetMasterService, WidgetMasterExceptionFilter],
})
export class WidgetMasterModule {}
