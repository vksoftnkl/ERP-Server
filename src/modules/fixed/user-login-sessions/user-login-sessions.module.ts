import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { UserLoginSessionsController } from './user-login-sessions.controller';
import { UserLoginSessionsExceptionFilter } from './user-login-sessions-exception.filter';
import { UserLoginSessionsService } from './user-login-sessions.service';

@Module({
  imports: [AuditLogModule],
  controllers: [UserLoginSessionsController],
  providers: [UserLoginSessionsService, UserLoginSessionsExceptionFilter],
})
export class UserLoginSessionsModule {}
