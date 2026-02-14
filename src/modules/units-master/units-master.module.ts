import { Module } from '@nestjs/common';
import { UnitExceptionFilter } from './unit-exception.filter';
import { UnitsMasterController } from './units-master.controller';
import { UnitsMasterService } from './units-master.service';

@Module({
  controllers: [UnitsMasterController],
  providers: [UnitsMasterService, UnitExceptionFilter],
})
export class UnitsMasterModule {}
