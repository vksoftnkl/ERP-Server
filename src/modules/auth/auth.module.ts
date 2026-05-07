import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { AuthSessionService } from './auth-session.service';
@Module({
  imports: [UsersModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthSessionService],
  exports: [TokenService, AuthSessionService],
})
export class AuthModule {}
