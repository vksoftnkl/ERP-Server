import { Module } from '@nestjs/common';
import { MasterLookupController } from './master-lookup.controller';
import { MasterLookupService } from './master-lookup.service';

@Module({
  controllers: [MasterLookupController],
  providers: [MasterLookupService],
})
export class MasterLookupModule {}
