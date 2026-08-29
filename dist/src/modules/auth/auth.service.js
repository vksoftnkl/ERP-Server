"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const auth_session_service_1 = require("./auth-session.service");
const token_service_1 = require("./token.service");
const scryptAsync = (0, node_util_1.promisify)(node_crypto_1.scrypt);
const SESSION_TOKEN_MAX_LENGTH = 200;
let AuthService = AuthService_1 = class AuthService {
    tokenService;
    authSessionService;
    prisma;
    requestContextService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(tokenService, authSessionService, prisma, requestContextService) {
        this.tokenService = tokenService;
        this.authSessionService = authSessionService;
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async login(loginAuthDto, requestMetadata = { userAgent: null, appVersion: null }) {
        const user = await this.findLoginUser(loginAuthDto.usrLoginName, loginAuthDto.device_type);
        if (!user) {
            await this.logUnmatchedLoginName(loginAuthDto.usrLoginName, loginAuthDto.device_type);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await this.verifyPassword(loginAuthDto.usrPassword, user.usrPasswordHash);
        if (!isPasswordValid) {
            this.logger.warn(`Login rejected for '${user.usrLoginName}' (${user.usrId}): password mismatch.`);
            try {
                await this.incrementFailedLogin(user.usrId);
            }
            catch (error) {
                this.logger.warn(`Skipping failed login count update for user ${user.usrId}: ${this.describeError(error)}`);
            }
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isWebDevice = loginAuthDto.device_type?.toLowerCase() === 'web';
        const device = loginAuthDto.device_id || isWebDevice
            ? await this.findAndUpdateDeviceOnLogin(loginAuthDto.device_id, user, {
                deviceType: loginAuthDto.device_type,
            })
            : null;
        const sessionScope = {
            branch_id: device?.devBranchId ?? null,
            device_id: device?.devId ?? null,
        };
        const issuedAccessToken = this.tokenService.signAccessToken({
            sub: user.usrId,
            user_name: user.usrLoginName,
            sid: this.authSessionService.createSessionId(),
            user_type: user.usrType ?? null,
            company_id: user.usrCompanyId ?? null,
            ...sessionScope,
        });
        const issuedRefreshToken = this.tokenService.signRefreshToken({
            sub: user.usrId,
            user_name: user.usrLoginName,
            sid: issuedAccessToken.payload.sid,
            user_type: user.usrType ?? null,
            company_id: user.usrCompanyId ?? null,
            ...sessionScope,
        });
        await this.authSessionService.storeTokenSession(issuedAccessToken.token, issuedAccessToken.payload, issuedRefreshToken.token);
        try {
            await this.updateUserOnLogin(user.usrId);
        }
        catch (error) {
            this.logger.warn(`Skipping user login timestamp update for user ${user.usrId}: ${this.describeError(error)}`);
        }
        try {
            await this.saveUserLoginSession(user, loginAuthDto, issuedAccessToken, issuedRefreshToken, requestMetadata);
        }
        catch (error) {
            this.logger.warn(`Skipping user login session persistence for user ${user.usrId}: ${this.describeError(error)}`);
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
    async refresh(refreshToken) {
        const refreshPayload = this.tokenService.verifyRefreshToken(refreshToken);
        await this.authSessionService.assertRefreshTokenIsActive(refreshToken, refreshPayload);
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
            throw new common_1.UnauthorizedException('User is no longer active');
        }
        const issuedAccessToken = this.tokenService.signAccessToken({
            sub: refreshPayload.sub,
            user_name: refreshPayload.user_name,
            sid: refreshPayload.sid,
            user_type: user.usrType ?? null,
            company_id: user.usrCompanyId ?? null,
            branch_id: refreshPayload.branch_id,
            device_id: refreshPayload.device_id,
        });
        await this.authSessionService.storeTokenSession(issuedAccessToken.token, issuedAccessToken.payload, refreshToken);
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
    async findLoginUser(userName, deviceType) {
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
    buildLoginChannelFilter(deviceType) {
        switch (this.resolveLoginChannel(deviceType)) {
            case 'web':
                return { usrWebLogin: true };
            case 'mobile':
                return { usrMobileLogin: true };
            case 'desktop':
                return { usrDesktopLogin: true };
            default:
                return {
                    OR: [{ usrWebLogin: true }, { usrDesktopLogin: true }, { usrMobileLogin: true }],
                };
        }
    }
    resolveLoginChannel(deviceType) {
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
        return 'desktop';
    }
    async logUnmatchedLoginName(userName, deviceType) {
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
                this.logger.warn(`Login rejected: no user named '${normalizedUserName}' (device type '${channel}').`);
                return;
            }
            const reasons = [];
            if (candidate.usrIsDeleted)
                reasons.push('user is deleted');
            if (!candidate.usrIsActive)
                reasons.push('user is inactive');
            if (candidate.usrIsLocked)
                reasons.push('user is locked');
            if (channel === 'web' && !candidate.usrWebLogin)
                reasons.push('web login is disabled');
            if (channel === 'desktop' && !candidate.usrDesktopLogin)
                reasons.push('desktop login is disabled');
            if (channel === 'mobile' && !candidate.usrMobileLogin)
                reasons.push('mobile login is disabled');
            if (channel === 'unspecified' &&
                !candidate.usrWebLogin && !candidate.usrDesktopLogin && !candidate.usrMobileLogin)
                reasons.push('all login channels are disabled');
            this.logger.warn(`Login rejected for '${normalizedUserName}' (${candidate.usrId}, device type '${channel}'): ` +
                `${reasons.length ? reasons.join(', ') : 'user did not match the login filter'}.`);
        }
        catch (error) {
            this.logger.warn(`Login rejected for '${normalizedUserName}': reason lookup failed: ${this.describeError(error)}`);
        }
    }
    async findAndUpdateDeviceOnLogin(deviceUid, user, opts = {}) {
        const now = new Date();
        const ip = this.requestContextService.getIpAddress();
        const resolvedType = opts.deviceType ?? 'Desktop';
        const lookupUid = resolvedType.toLowerCase() === 'web' ? `web:${user.usrId}` : deviceUid;
        if (!lookupUid) {
            throw new common_1.UnauthorizedException('Device not registered');
        }
        const isWeb = resolvedType.toLowerCase() === 'web';
        const isDesktopOrMobile = this.resolveLoginChannel(resolvedType) !== 'web';
        if (isWeb) {
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
                throw new common_1.UnauthorizedException('Device not registered. Please contact administrator.');
            }
            const usableDevices = webDevices.filter((candidate) => !candidate.devIsBlocked && candidate.devIsActive && !candidate.devIsDeleted);
            if (usableDevices.length === 0) {
                const blockedDevice = webDevices.find((candidate) => candidate.devIsBlocked);
                if (blockedDevice) {
                    this.logger.warn(`Web login rejected for user ${user.usrId}: device ${blockedDevice.devDeviceUid} is blocked.`);
                    throw new common_1.UnauthorizedException(this.describeBlockedDevice(blockedDevice));
                }
                this.logger.warn(`Web login rejected for user ${user.usrId}: no active web device among ` +
                    `${webDevices.map((candidate) => candidate.devDeviceUid).join(', ')}.`);
                throw new common_1.UnauthorizedException('Device is not available. Please contact administrator.');
            }
            const webDevice = usableDevices.find((candidate) => candidate.devDeviceUid === lookupUid) ?? usableDevices[0];
            return this.prisma.deviceMaster.update({
                where: { devId: webDevice.devId },
                data: {
                    devLastIp: ip,
                    devLastLogin: now,
                    devModifiedOn: now,
                    devModifiedBy: user.usrId,
                },
            });
        }
        const existing = await this.prisma.deviceMaster.findUnique({
            where: { devDeviceUid: lookupUid },
        });
        if (!existing) {
            throw new common_1.UnauthorizedException('Device not registered. Please contact administrator.');
        }
        if (isDesktopOrMobile) {
            if (existing.devIsBlocked) {
                this.logger.warn(`Login rejected for user ${user.usrId}: device ${existing.devDeviceUid} is blocked.`);
                throw new common_1.UnauthorizedException(this.describeBlockedDevice(existing));
            }
            if (!existing.devIsActive || existing.devIsDeleted) {
                this.logger.warn(`Login rejected for user ${user.usrId}: device ${existing.devDeviceUid} is inactive or deleted.`);
                throw new common_1.UnauthorizedException('Device is not available. Please contact administrator.');
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
    describeBlockedDevice(device) {
        const reason = device.devBlockReason?.trim();
        return reason ? reason : 'Device is blocked. Please contact administrator.';
    }
    async updateUserOnLogin(usrId) {
        await this.prisma.userMaster.update({
            where: { usrId },
            data: {
                usrLastLoginOn: new Date(),
                usrFailedLoginCount: 0,
            },
        });
    }
    async incrementFailedLogin(usrId) {
        await this.prisma.userMaster.update({
            where: { usrId },
            data: {
                usrFailedLoginCount: { increment: 1 },
                usrLastFailedLoginOn: new Date(),
            },
        });
    }
    async verifyPassword(plainPassword, storedPassword) {
        try {
            const [algorithm, salt, hashHex] = storedPassword.split('$');
            if (algorithm !== 'scrypt' || !salt || !hashHex) {
                return false;
            }
            const storedHashBuffer = Buffer.from(hashHex, 'hex');
            if (storedHashBuffer.length === 0) {
                return false;
            }
            const computedHashBuffer = (await scryptAsync(plainPassword, salt, storedHashBuffer.length));
            if (computedHashBuffer.length !== storedHashBuffer.length) {
                return false;
            }
            return (0, node_crypto_1.timingSafeEqual)(computedHashBuffer, storedHashBuffer);
        }
        catch {
            return false;
        }
    }
    async saveUserLoginSession(user, loginAuthDto, issuedAccessToken, issuedRefreshToken, requestMetadata) {
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
    normalizeSessionToken(token) {
        if (token.length <= SESSION_TOKEN_MAX_LENGTH) {
            return token;
        }
        return `sha256:${(0, node_crypto_1.createHash)('sha256').update(token).digest('hex')}`;
    }
    describeError(error) {
        if (error instanceof Error && error.message.trim()) {
            return error.message.trim();
        }
        return 'unknown error';
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [token_service_1.TokenService,
        auth_session_service_1.AuthSessionService,
        prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], AuthService);
//# sourceMappingURL=auth.service.js.map