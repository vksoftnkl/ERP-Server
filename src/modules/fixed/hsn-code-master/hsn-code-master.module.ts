import { Module } from '@nestjs/common';
import { HsnCodeMasterController } from './hsn-code-master.controller';
import { HsnCodeMasterService } from './hsn-code-master.service';

@Module({
  controllers: [HsnCodeMasterController],
  providers: [HsnCodeMasterService],
})
export class HsnCodeMasterModule {}
