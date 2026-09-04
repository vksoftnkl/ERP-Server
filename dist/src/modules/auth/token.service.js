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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
let TokenService = class TokenService {
    configService;
    secret;
    accessTokenTtlSeconds;
    refreshTokenTtlSeconds;
    constructor(configService) {
        this.configService = configService;
        this.secret = this.configService.get('auth.jwtSecret', '');
        this.accessTokenTtlSeconds = this.configService.get('auth.accessTokenTtlSeconds', 15 * 60);
        this.refreshTokenTtlSeconds = this.configService.get('auth.refreshTokenTtlSeconds', 7 * 24 * 60 * 60);
    }
    signAccessToken(claims) {
        return this.signToken(claims, 'access', this.accessTokenTtlSeconds);
    }
    signRefreshToken(claims) {
        return this.signToken(claims, 'refresh', this.refreshTokenTtlSeconds);
    }
    signToken(claims, tokenType, ttlSeconds) {
        if (!this.secret) {
            throw new common_1.InternalServerErrorException('JWT secret is not configured');
        }
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            ...claims,
            iat: now,
            exp: now + ttlSeconds,
            typ: tokenType,
        };
        const headerSegment = this.encodeBase64Url({
            alg: 'HS256',
            typ: 'JWT',
        });
        const payloadSegment = this.encodeBase64Url(payload);
        const unsignedToken = `${headerSegment}.${payloadSegment}`;
        const signature = (0, node_crypto_1.createHmac)('sha256', this.secret).update(unsignedToken).digest('base64url');
        return {
            token: `${unsignedToken}.${signature}`,
            payload,
        };
    }
    verifyAccessToken(token) {
        return this.verifyToken(token, 'access');
    }
    verifyRefreshToken(token) {
        return this.verifyToken(token, 'refresh');
    }
    verifyToken(token, expectedType) {
        if (!this.secret) {
            throw new common_1.InternalServerErrorException('JWT secret is not configured');
        }
        const tokenSegments = token.split('.');
        if (tokenSegments.length !== 3) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const [headerSegment, payloadSegment, signatureSegment] = tokenSegments;
        const header = this.decodeSegment(headerSegment);
        if (header.alg !== 'HS256' || header.typ !== 'JWT') {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const unsignedToken = `${headerSegment}.${payloadSegment}`;
        const expectedSignature = (0, node_crypto_1.createHmac)('sha256', this.secret)
            .update(unsignedToken)
            .digest('base64url');
        if (!this.compareSignatures(signatureSegment, expectedSignature)) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const payloadRecord = this.decodeSegment(payloadSegment);
        return this.validatePayload(payloadRecord, expectedType);
    }
    encodeBase64Url(data) {
        return Buffer.from(JSON.stringify(data)).toString('base64url');
    }
    decodeSegment(segment) {
        try {
            const json = Buffer.from(segment, 'base64url').toString('utf8');
            return JSON.parse(json);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
    }
    compareSignatures(receivedSignature, expectedSignature) {
        const receivedBuffer = Buffer.from(receivedSignature, 'utf8');
        const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
        if (receivedBuffer.length !== expectedBuffer.length) {
            return false;
        }
        return (0, node_crypto_1.timingSafeEqual)(receivedBuffer, expectedBuffer);
    }
    validatePayload(payload, expectedType) {
        const sub = payload.sub;
        const userName = payload.user_name;
        const sessionId = payload.sid;
        const issuedAt = payload.iat;
        const expiresAt = payload.exp;
        const tokenType = payload.typ;
        const userType = payload.user_type;
        const companyId = payload.company_id;
        const branchId = payload.branch_id;
        const deviceId = payload.device_id;
        if (typeof sub !== 'string' || sub.length === 0) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (typeof userName !== 'string' || userName.length === 0) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (typeof sessionId !== 'string' || sessionId.length === 0) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (typeof issuedAt !== 'number' ||
            !Number.isInteger(issuedAt) ||
            issuedAt < 0) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (typeof expiresAt !== 'number' ||
            !Number.isInteger(expiresAt) ||
            expiresAt <= issuedAt ||
            expiresAt <= Math.floor(Date.now() / 1000)) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (tokenType !== expectedType) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (userType !== undefined && userType !== null && typeof userType !== 'string') {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (companyId !== undefined && companyId !== null && typeof companyId !== 'string') {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (branchId !== undefined && branchId !== null && typeof branchId !== 'string') {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (deviceId !== undefined && deviceId !== null && typeof deviceId !== 'string') {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const normalizedPayload = {
            sub,
            user_name: userName,
            sid: sessionId,
            user_type: typeof userType === 'string' && userType.length > 0 ? userType : null,
            company_id: typeof companyId === 'string' && companyId.length > 0 ? companyId : null,
            branch_id: typeof branchId === 'string' && branchId.length > 0 ? branchId : null,
            device_id: typeof deviceId === 'string' && deviceId.length > 0 ? deviceId : null,
            iat: issuedAt,
            exp: expiresAt,
            typ: expectedType,
        };
        return normalizedPayload;
    }
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TokenService);
//# sourceMappingURL=token.service.js.map