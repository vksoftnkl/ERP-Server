import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppVersionModule } from '../app-version/app-version.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { AuthSessionService } from './auth-session.service';
@Module({
  // AuditLogModule: POST /auth/change-password writes one audit row (no password, no hash).
  imports: [UsersModule, ConfigModule, AppVersionModule, AuditLogModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthSessionService],
  exports: [TokenService, AuthSessionService],
})
export class AuthModule {}
