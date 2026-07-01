import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ConfigsController } from './configs.controller';
import { ConfigsExceptionFilter } from './configs-exception.filter';
import { ConfigsService } from './configs.service';
@Module({
  imports: [AuditLogModule],
  controllers: [ConfigsController],
  providers: [ConfigsService, ConfigsExceptionFilter],
})
export class ConfigsModule {}
