import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DeviceMaster, Prisma, UserMaster } from '@prisma/client';
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
    const user = await this.findLoginUser(loginAuthDto.usrLoginName, loginAuthDto.device_type);
    if (!user) {
      await this.logUnmatchedLoginName(loginAuthDto.usrLoginName, loginAuthDto.device_type);
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await this.verifyPassword(
      loginAuthDto.usrPassword,
      user.usrPasswordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(
        `Login rejected for '${user.usrLoginName}' (${user.usrId}): password mismatch.`,
      );
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
      user_type: user.usrType ?? null,
      company_id: user.usrCompanyId ?? null,
    });
    const issuedRefreshToken = this.tokenService.signRefreshToken({
      sub: user.usrId,
      user_name: user.usrLoginName,
      sid: issuedAccessToken.payload.sid,
      user_type: user.usrType ?? null,
      company_id: user.usrCompanyId ?? null,
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
      user_name: user.usrLoginName,
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
    // Re-read the user so role/company changes and lockouts take effect on the
    // next refresh instead of persisting for the refresh token's whole lifetime.
    const user = await this.prisma.userMaster.findFirst({
      where: {
        usrId: refreshPayload.sub,
        usrIsDeleted: false,
        usrIsActive: true,
        usrIsLocked: false,
      },
      select: { usrType: true, usrCompanyId: true },
    });
    if (!user) {
      throw new UnauthorizedException('User is no longer active');
    }
    const issuedAccessToken = this.tokenService.signAccessToken({
      sub: refreshPayload.sub,
      user_name: refreshPayload.user_name,
      sid: refreshPayload.sid,
      user_type: user.usrType ?? null,
      company_id: user.usrCompanyId ?? null,
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
      user_type: user.usrType ?? null,
      user_name: refreshPayload.user_name,
      device_id: null,
      device_name: null,
      dev_company_id: null,
      dev_branch_id: null,
      dev_user_id: null,
      device_type: null,
    };
  }
  private async findLoginUser(
    userName: string,
    deviceType?: string | null,
  ): Promise<UserMaster | null> {
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
        ...this.buildLoginChannelFilter(deviceType),
      },
    });
  }
  // Every login used to require usrWebLogin, so a desktop or mobile client was
  // rejected with 'Invalid credentials' whenever web access happened to be off —
  // even though its own channel flag was on. Gate on the flag for the channel the
  // client actually logged in from.
  private buildLoginChannelFilter(deviceType?: string | null): Prisma.UserMasterWhereInput {
    switch (this.resolveLoginChannel(deviceType)) {
      case 'web':
        return { usrWebLogin: true };
      case 'mobile':
        return { usrMobileLogin: true };
      case 'desktop':
        return { usrDesktopLogin: true };
      default:
        // The client did not say where it is logging in from; accept the user as
        // long as at least one channel is open to them.
        return {
          OR: [{ usrWebLogin: true }, { usrDesktopLogin: true }, { usrMobileLogin: true }],
        };
    }
  }
  private resolveLoginChannel(deviceType?: string | null): 'web' | 'mobile' | 'desktop' | null {
    const normalized = deviceType?.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['web', 'browser'].includes(normalized)) {
      return 'web';
    }
    if (['mobile', 'android', 'ios', 'tablet', 'phone'].includes(normalized)) {
      return 'mobile';
    }
    // device_master stores desktop terminals as 'Desktop', 'PC' and 'POS'; anything
    // that is not a browser or a handheld is treated as a desktop client.
    return 'desktop';
  }
  // 'Invalid credentials' is deliberately vague to the client, but the server log
  // should say which of the four reasons it was, or a login problem cannot be
  // diagnosed without guessing at the caller's payload.
  private async logUnmatchedLoginName(userName: string, deviceType?: string | null): Promise<void> {
    const normalizedUserName = userName.trim();
    const channel = this.resolveLoginChannel(deviceType) ?? 'unspecified';
    if (!normalizedUserName) {
      this.logger.warn(`Login rejected: empty login name (device type '${channel}').`);
      return;
    }
    try {
      const candidate = await this.prisma.userMaster.findFirst({
        where: { usrLoginName: { equals: normalizedUserName, mode: 'insensitive' } },
        select: {
          usrId: true,
          usrIsDeleted: true,
          usrIsActive: true,
          usrIsLocked: true,
          usrWebLogin: true,
          usrDesktopLogin: true,
          usrMobileLogin: true,
        },
      });
      if (!candidate) {
        this.logger.warn(
          `Login rejected: no user named '${normalizedUserName}' (device type '${channel}').`,
        );
        return;
      }
      const reasons: string[] = [];
      if (candidate.usrIsDeleted) reasons.push('user is deleted');
      if (!candidate.usrIsActive) reasons.push('user is inactive');
      if (candidate.usrIsLocked) reasons.push('user is locked');
      if (channel === 'web' && !candidate.usrWebLogin) reasons.push('web login is disabled');
      if (channel === 'desktop' && !candidate.usrDesktopLogin)
        reasons.push('desktop login is disabled');
      if (channel === 'mobile' && !candidate.usrMobileLogin)
        reasons.push('mobile login is disabled');
      if (channel === 'unspecified' &&
        !candidate.usrWebLogin && !candidate.usrDesktopLogin && !candidate.usrMobileLogin)
        reasons.push('all login channels are disabled');
      this.logger.warn(
        `Login rejected for '${normalizedUserName}' (${candidate.usrId}, device type '${channel}'): ` +
          `${reasons.length ? reasons.join(', ') : 'user did not match the login filter'}.`,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Login rejected for '${normalizedUserName}': reason lookup failed: ${this.describeError(error)}`,
      );
    }
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
    // The desktop client registers itself as 'PC', which used to fall outside this
    // list and so skipped the blocked/inactive device checks altogether.
    const isDesktopOrMobile = this.resolveLoginChannel(resolvedType) !== 'web';

    if (isWeb) {
      // Device type is stored inconsistently ('Web' and 'web' both exist), so match
      // it case-insensitively instead of pinning the exact casing.
      const webDevices = await this.prisma.deviceMaster.findMany({
        where: {
          devUserId: user.usrId,
          devDeviceType: { equals: 'Web', mode: 'insensitive' },
        },
        orderBy: [
          { devLastLogin: { sort: 'desc', nulls: 'last' } },
          { devCreatedOn: 'desc' },
        ],
      });
      if (webDevices.length === 0) {
        throw new UnauthorizedException('Device not registered. Please contact administrator.');
      }
      // Web logins used to skip the blocked/inactive checks the desktop and mobile
      // branch below applies, so a blocked or soft-deleted device still let the user in.
      const usableDevices = webDevices.filter(
        (candidate) => !candidate.devIsBlocked && candidate.devIsActive && !candidate.devIsDeleted,
      );
      if (usableDevices.length === 0) {
        const blockedDevice = webDevices.find((candidate) => candidate.devIsBlocked);
        if (blockedDevice) {
          this.logger.warn(
            `Web login rejected for user ${user.usrId}: device ${blockedDevice.devDeviceUid} is blocked.`,
          );
          throw new UnauthorizedException(this.describeBlockedDevice(blockedDevice));
        }
        this.logger.warn(
          `Web login rejected for user ${user.usrId}: no active web device among ` +
            `${webDevices.map((candidate) => candidate.devDeviceUid).join(', ')}.`,
        );
        throw new UnauthorizedException('Device is not available. Please contact administrator.');
      }
      // Prefer the canonical per-user row so repeat logins keep landing on the same
      // device; older `WEB-<uuid>` registrations remain valid as a fallback.
      const webDevice =
        usableDevices.find((candidate) => candidate.devDeviceUid === lookupUid) ?? usableDevices[0];
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
        this.logger.warn(
          `Login rejected for user ${user.usrId}: device ${existing.devDeviceUid} is blocked.`,
        );
        throw new UnauthorizedException(this.describeBlockedDevice(existing));
      }
      if (!existing.devIsActive || existing.devIsDeleted) {
        this.logger.warn(
          `Login rejected for user ${user.usrId}: device ${existing.devDeviceUid} is inactive or deleted.`,
        );
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
  private describeBlockedDevice(device: DeviceMaster): string {
    // devBlockReason is often an empty string rather than NULL, so `??` alone
    // would surface a blank message to the client.
    const reason = device.devBlockReason?.trim();
    return reason ? reason : 'Device is blocked. Please contact administrator.';
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