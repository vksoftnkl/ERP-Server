import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { VehicleController } from './vehicle.controller';
import { VehicleExceptionFilter } from './vehicle-exception.filter';
import { VehicleService } from './vehicle.service';

@Module({
  imports: [AuditLogModule],
  controllers: [VehicleController],
  providers: [VehicleService, VehicleExceptionFilter],
})
export class VehicleModule {}
