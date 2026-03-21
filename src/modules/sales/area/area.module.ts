import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AreaController } from './area.controller';
import { AreaExceptionFilter } from './area-exception.filter';
import { AreaService } from './area.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AreaController],
  providers: [AreaService, AreaExceptionFilter],
})
export class AreaModule {}
