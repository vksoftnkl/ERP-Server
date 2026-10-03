import { Module } from '@nestjs/common';
import { GstModule } from '../../gst/gst.module';
import { GstinLookupController } from './gstin-lookup.controller';
import { GstinLookupExceptionFilter } from './gstin-lookup-exception.filter';
import { GstinLookupService } from './gstin-lookup.service';

@Module({
  // Notes 87: search runs on the GST Provider rows — GstCryptoService opens the
  // account's ASP pair, GstHttpClient sends the call.
  imports: [GstModule],
  controllers: [GstinLookupController],
  providers: [GstinLookupService, GstinLookupExceptionFilter],
})
export class GstinLookupModule {}
