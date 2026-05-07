import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { createHash, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthSessionService } from './auth-session.service';
import { SignedAccessToken, SignedRefreshToken, TokenService } from './token.service';
const scryptAsync = promisify(nodeScrypt);
const SESSION_TOKEN_MAX_LENGTH = 200;
type LoginRequestMetadata = {
  userAgent: string | null;
  appVersion: string | null;
};
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly authSessionService: AuthSessionService,
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async login(
    loginAuthDto: LoginAuthDto,
    requestMetadata: LoginRequestMetadata = { userAgent: null, appVersion: null },
  ): Promise<LoginResponseDto> {
    const user = await this.usersService.findByUsername(loginAuthDto.user_name);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await this.verifyPassword(
      loginAuthDto.user_password,
      user.user_password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const issuedAccessToken = this.tokenService.signAccessToken({
      sub: user.user_id,
      user_name: user.user_name,
      sid: this.authSessionService.createSessionId(),
    });
    const issuedRefreshToken = this.tokenService.signRefreshToken({
      sub: user.user_id,
      user_name: user.user_name,
      sid: issuedAccessToken.payload.sid,
    });
    await this.authSessionService.storeTokenSession(
      issuedAccessToken.token,
      issuedAccessToken.payload,
      issuedRefreshToken.token,
    );
    try {
      await this.saveUserLoginSession(
        user,
        loginAuthDto,
        issuedAccessToken,
        issuedRefreshToken,
        requestMetadata,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Skipping user login session persistence for user ${user.user_id}: ${this.describeError(
          error,
        )}`,
      );
    }
    return {
      access_token: issuedAccessToken.token,
      refresh_token: issuedRefreshToken.token,
      token_type: 'Bearer',
      user_id: user.user_id,
    };
  }
  async refresh(refreshToken: string): Promise<LoginResponseDto> {
    const refreshPayload = this.tokenService.verifyRefreshToken(refreshToken);
    await this.authSessionService.assertRefreshTokenIsActive(refreshToken, refreshPayload);
    const issuedAccessToken = this.tokenService.signAccessToken({
      sub: refreshPayload.sub,
      user_name: refreshPayload.user_name,
      sid: refreshPayload.sid,
    });
    await this.authSessionService.storeTokenSession(
      issuedAccessToken.token,
      issuedAccessToken.payload,
      refreshToken,
    );
    return {
      access_token: issuedAccessToken.token,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      user_id: refreshPayload.sub,
    };
  }
  private async verifyPassword(plainPassword: string, storedPassword: string): Promise<boolean> {
    try {
      const [algorithm, salt, hashHex] = storedPassword.split('$');
      if (algorithm !== 'scrypt' || !salt || !hashHex) {
        return false;
      }
      const storedHashBuffer = Buffer.from(hashHex, 'hex');
      if (storedHashBuffer.length === 0) {
        return false;
      }
      const computedHashBuffer = (await scryptAsync(
        plainPassword,
        salt,
        storedHashBuffer.length,
      )) as Buffer;
      if (computedHashBuffer.length !== storedHashBuffer.length) {
        return false;
      }
      return timingSafeEqual(computedHashBuffer, storedHashBuffer);
    } catch {
      return false;
    }
  }
  private async saveUserLoginSession(
    user: User,
    loginAuthDto: LoginAuthDto,
    issuedAccessToken: SignedAccessToken,
    issuedRefreshToken: SignedRefreshToken,
    requestMetadata: LoginRequestMetadata,
  ): Promise<void> {
    const loginTimestamp = new Date();
    const resolvedAppVersion = loginAuthDto.app_version ?? requestMetadata.appVersion ?? null;
    await this.prisma.userLoginSession.create({
      data: {
        ulsCompanyId: null,
        ulsBranchId: null,
        ulsUserId: user.user_id,
        ulsDeviceId: loginAuthDto.device_id ?? null,
        ulsSessionId: issuedAccessToken.payload.sid,
        ulsSessionToken: this.normalizeSessionToken(issuedAccessToken.token),
        ulsRefreshTokenId: this.normalizeSessionToken(issuedRefreshToken.token),
        ulsLoginOn: loginTimestamp,
        ulsLoginStatus: 'SUCCESS',
        ulsIpAddress: this.requestContextService.getIpAddress(),
        ulsUserAgent: requestMetadata.userAgent,
        ulsAppVersion: resolvedAppVersion,
        ulsIsActiveSession: true,
        ulsIsActive: true,
        ulsCreatedOn: loginTimestamp,
        ulsCreatedBy: user.user_id,
        ulsModifiedOn: loginTimestamp,
        ulsModifiedBy: user.user_id,
      },
    });
  }
  private normalizeSessionToken(token: string): string {
    if (token.length <= SESSION_TOKEN_MAX_LENGTH) {
      return token;
    }
    return `sha256:${createHash('sha256').update(token).digest('hex')}`;
  }
  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return 'unknown error';
  }
}
