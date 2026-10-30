import { Global, Module } from '@nestjs/common';
import { DataChangeService } from './data-change.service';
import { DataChangesController } from './data-changes.controller';

@Global()
@Module({
  controllers: [DataChangesController],
  providers: [DataChangeService],
  exports: [DataChangeService],
})
export class DataChangesModule {}
