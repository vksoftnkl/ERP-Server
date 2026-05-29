import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DeviceMaster, UserMaster } from '@prisma/client';
import { createHash, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
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
    private readonly tokenService: TokenService,
    private readonly authSessionService: AuthSessionService,
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async login(
    loginAuthDto: LoginAuthDto,
    requestMetadata: LoginRequestMetadata = { userAgent: null, appVersion: null },
  ): Promise<LoginResponseDto> {
    const user = await this.findLoginUser(loginAuthDto.usrLoginName);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await this.verifyPassword(
      loginAuthDto.usrPassword,
      user.usrPasswordHash,
    );
    if (!isPasswordValid) {
      try {
        await this.incrementFailedLogin(user.usrId);
      } catch (error: unknown) {
        this.logger.warn(
          `Skipping failed login count update for user ${user.usrId}: ${this.describeError(error)}`,
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }
    const isWebDevice = loginAuthDto.device_type?.toLowerCase() === 'web';
    const device =
      loginAuthDto.device_id || isWebDevice
        ? await this.findAndUpdateDeviceOnLogin(loginAuthDto.device_id, user, {
            deviceType: loginAuthDto.device_type,
          })
        : null;
    const issuedAccessToken = this.tokenService.signAccessToken({
      sub: user.usrId,
      user_name: user.usrLoginName,
      sid: this.authSessionService.createSessionId(),
    });
    const issuedRefreshToken = this.tokenService.signRefreshToken({
      sub: user.usrId,
      user_name: user.usrLoginName,
      sid: issuedAccessToken.payload.sid,
    });
    await this.authSessionService.storeTokenSession(
      issuedAccessToken.token,
      issuedAccessToken.payload,
      issuedRefreshToken.token,
    );
    try {
      await this.updateUserOnLogin(user.usrId);
    } catch (error: unknown) {
      this.logger.warn(
        `Skipping user login timestamp update for user ${user.usrId}: ${this.describeError(error)}`,
      );
    }
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
        `Skipping user login session persistence for user ${user.usrId}: ${this.describeError(
          error,
        )}`,
      );
    }
    return {
      access_token: issuedAccessToken.token,
      refresh_token: issuedRefreshToken.token,
      token_type: 'Bearer',
      usrId: user.usrId,
      user_type: user.usrType ?? null,
      user_name: user.usrDisplayName,
      device_id: device?.devId ?? null,
      device_name: device?.devDeviceName ?? null,
      dev_company_id: device?.devCompanyId ?? null,
      dev_branch_id: device?.devBranchId ?? null,
      dev_user_id: device?.devUserId ?? null,
      device_type: device?.devDeviceType ?? null,
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
      usrId: refreshPayload.sub,
      user_type: null,
      user_name: refreshPayload.user_name,
      device_id: null,
      device_name: null,
      dev_company_id: null,
      dev_branch_id: null,
      dev_user_id: null,
      device_type: null,
    };
  }
  private async findLoginUser(userName: string): Promise<UserMaster | null> {
    const normalizedUserName = userName.trim();
    if (!normalizedUserName) {
      return null;
    }
    return this.prisma.userMaster.findFirst({
      where: {
        usrLoginName: { equals: normalizedUserName, mode: 'insensitive' },
        usrIsDeleted: false,
        usrIsActive: true,
        usrIsLocked: false,
        usrWebLogin: true,
      },
    });
  }
  private async findAndUpdateDeviceOnLogin(
    deviceUid: string | undefined,
    user: UserMaster,
    opts: { deviceType?: string } = {},
  ): Promise<DeviceMaster> {
    const now = new Date();
    const ip = this.requestContextService.getIpAddress();
    const resolvedType = opts.deviceType ?? 'Desktop';
    const lookupUid =
      resolvedType.toLowerCase() === 'web' ? `web:${user.usrId}` : deviceUid;
    if (!lookupUid) {
      throw new UnauthorizedException('Device not registered');
    }
    const isWeb = resolvedType.toLowerCase() === 'web';
    const isDesktopOrMobile = ['desktop', 'mobile'].includes(resolvedType.toLowerCase());

    if (isWeb) {
      const webDevice = await this.prisma.deviceMaster.findFirst({
        where: { devUserId: user.usrId, devDeviceType: 'Web' },
      });
      if (!webDevice) {
        throw new UnauthorizedException('Device not registered. Please contact administrator.');
      }
      return this.prisma.deviceMaster.update({
        where: { devId: webDevice.devId },
        data: {
          devLastIp: ip,
          devLastLogin: now,
          devModifiedOn: now,
          devModifiedBy: user.usrId,
        },
      });
    }    const existing = await this.prisma.deviceMaster.findUnique({
      where: { devDeviceUid: lookupUid },
    });
    if (!existing) {
      throw new UnauthorizedException('Device not registered. Please contact administrator.');
    }
    if (isDesktopOrMobile) {
      if (existing.devIsBlocked) {
        throw new UnauthorizedException(existing.devBlockReason ?? 'Device is blocked. Please contact administrator.');
      }
      if (!existing.devIsActive || existing.devIsDeleted) {
        throw new UnauthorizedException('Device is not available. Please contact administrator.');
      }
    }
    return this.prisma.deviceMaster.update({
      where: { devDeviceUid: lookupUid },
      data: {
        devUserId: user.usrId,
        devCompanyId: user.usrCompanyId,
        devBranchId: user.usrBranchId,
        devLastIp: ip,
        devLastLogin: now,
        devModifiedOn: now,
        devModifiedBy: user.usrId,
        ...(opts.deviceType !== undefined && { devDeviceType: opts.deviceType }),
      },
    });
  }
  private async updateUserOnLogin(usrId: string): Promise<void> {
    await this.prisma.userMaster.update({
      where: { usrId },
      data: {
        usrLastLoginOn: new Date(),
        usrFailedLoginCount: 0,
      },
    });
  }
  private async incrementFailedLogin(usrId: string): Promise<void> {
    await this.prisma.userMaster.update({
      where: { usrId },
      data: {
        usrFailedLoginCount: { increment: 1 },
        usrLastFailedLoginOn: new Date(),
      },
    });
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
    user: UserMaster,
    loginAuthDto: LoginAuthDto,
    issuedAccessToken: SignedAccessToken,
    issuedRefreshToken: SignedRefreshToken,
    requestMetadata: LoginRequestMetadata,
  ): Promise<void> {
    const loginTimestamp = new Date();
    const resolvedAppVersion = loginAuthDto.app_version ?? requestMetadata.appVersion ?? null;
    await this.prisma.userLoginSession.create({
      data: {
        ulsCompanyId: user.usrCompanyId,
        ulsBranchId: user.usrBranchId,
        ulsUserId: user.usrId,
        ulsDeviceId: loginAuthDto.device_id ?? null,
        ulsSessionId: issuedAccessToken.payload.sid,
        ulsSessionToken: this.normalizeSessionToken(issuedAccessToken.token),
        ulsRefreshTokenId: this.normalizeSessionToken(issuedRefreshToken.token),
        ulsLoginOn: loginTimestamp,
        ulsLoginStatus: 'SUCCESS',
        ulsIpAddress: loginAuthDto.ip_address ?? this.requestContextService.getIpAddress(),
        ulsUserAgent: requestMetadata.userAgent,
        ulsAppVersion: resolvedAppVersion,
        ulsIsActiveSession: true,
        ulsIsActive: true,
        ulsCreatedOn: loginTimestamp,
        ulsCreatedBy: user.usrId,
        ulsModifiedOn: loginTimestamp,
        ulsModifiedBy: user.usrId,
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
  }}