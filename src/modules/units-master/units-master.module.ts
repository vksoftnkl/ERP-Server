import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UnitExceptionFilter } from './unit-exception.filter';
import { UnitsMasterController } from './units-master.controller';
import { UnitsMasterService } from './units-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [UnitsMasterController],
  providers: [UnitsMasterService, UnitExceptionFilter],
})
export class UnitsMasterModule {}
