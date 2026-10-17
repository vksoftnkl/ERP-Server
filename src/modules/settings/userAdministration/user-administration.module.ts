import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { UserAdministrationController } from './user-administration.controller';
import { UserAdministrationExceptionFilter } from './user-administration-exception.filter';
import { UserAdministrationService } from './user-administration.service';

@Module({
  imports: [AuditLogModule],
  controllers: [UserAdministrationController],
  providers: [UserAdministrationService, UserAdministrationExceptionFilter],
})
export class UserAdministrationModule {}
