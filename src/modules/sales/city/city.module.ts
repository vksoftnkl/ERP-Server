import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { CityController } from './city.controller';
import { CityExceptionFilter } from './city-exception.filter';
import { CityService } from './city.service';

@Module({
  imports: [AuditLogModule],
  controllers: [CityController],
  providers: [CityService, CityExceptionFilter],
})
export class CityModule {}
