import { Module } from '@nestjs/common';
import { PriceLevelMasterController } from './price-level-master.controller';
import { PriceLevelMasterService } from './price-level-master.service';
@Module({
  controllers: [PriceLevelMasterController],
  providers: [PriceLevelMasterService],
})
export class PriceLevelMasterModule {}