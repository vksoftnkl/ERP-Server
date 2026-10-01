import { Module } from '@nestjs/common';
import { GstinLookupController } from './gstin-lookup.controller';
import { GstinLookupExceptionFilter } from './gstin-lookup-exception.filter';
import { GstinLookupService } from './gstin-lookup.service';

@Module({
  controllers: [GstinLookupController],
  providers: [GstinLookupService, GstinLookupExceptionFilter],
})
export class GstinLookupModule {}
