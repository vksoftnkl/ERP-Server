import { Module } from '@nestjs/common';
import { MenuMasterController } from './menu-master.controller';
import { MenuMasterService } from './menu-master.service';

@Module({
  controllers: [MenuMasterController],
  providers: [MenuMasterService],
})
export class MenuMasterModule {}

