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
exports.AuthSessionService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const redis_cache_service_1 = require("../../common/redis/redis-cache.service");
const AUTH_SESSION_KEY_PREFIX = 'auth:session';
let AuthSessionService = class AuthSessionService {
    redisCacheService;
    constructor(redisCacheService) {
        this.redisCacheService = redisCacheService;
    }
    createSessionId() {
        return (0, node_crypto_1.randomUUID)();
    }
    async storeTokenSession(accessToken, accessTokenPayload, refreshToken) {
        if (!this.redisCacheService.isEnabled()) {
            return;
        }
        const session = {
            sid: accessTokenPayload.sid,
            sub: accessTokenPayload.sub,
            user_name: accessTokenPayload.user_name,
            token_hash: this.hashToken(accessToken),
            refresh_token_hash: this.hashToken(refreshToken),
            iat: accessTokenPayload.iat,
            exp: accessTokenPayload.exp,
        };
        try {
            await this.redisCacheService.set(this.buildSessionKey(accessTokenPayload.sid), JSON.stringify(session));
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException) {
                return;
            }
            throw error;
        }
    }
    async storeAccessTokenSession(token, payload) {
        await this.storeTokenSession(token, payload, '');
    }
    async assertAccessTokenIsActive(token, payload) {
        if (!this.redisCacheService.isEnabled()) {
            return;
        }
        let cachedSessionValue;
        try {
            cachedSessionValue = await this.redisCacheService.get(this.buildSessionKey(payload.sid));
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException) {
                return;
            }
            throw error;
        }
        if (!cachedSessionValue) {
            throw new common_1.UnauthorizedException('Access token is no longer active');
        }
        const cachedSession = this.parseSession(cachedSessionValue);
        if (!cachedSession) {
            throw new common_1.UnauthorizedException('Access token session is invalid');
        }
        if (cachedSession.sid !== payload.sid ||
            cachedSession.sub !== payload.sub ||
            cachedSession.user_name !== payload.user_name ||
            cachedSession.token_hash !== this.hashToken(token)) {
            throw new common_1.UnauthorizedException('Access token is no longer active');
        }
    }
    async assertRefreshTokenIsActive(token, payload) {
        if (!this.redisCacheService.isEnabled()) {
            return;
        }
        let cachedSessionValue;
        try {
            cachedSessionValue = await this.redisCacheService.get(this.buildSessionKey(payload.sid));
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException) {
                return;
            }
            throw error;
        }
        if (!cachedSessionValue) {
            throw new common_1.UnauthorizedException('Refresh token is no longer active');
        }
        const cachedSession = this.parseSession(cachedSessionValue);
        if (!cachedSession) {
            throw new common_1.UnauthorizedException('Refresh token session is invalid');
        }
        if (cachedSession.sid !== payload.sid ||
            cachedSession.sub !== payload.sub ||
            cachedSession.user_name !== payload.user_name ||
            cachedSession.refresh_token_hash !== this.hashToken(token)) {
            throw new common_1.UnauthorizedException('Refresh token is no longer active');
        }
    }
    async revokeAccessTokenSession(payload) {
        if (!this.redisCacheService.isEnabled()) {
            return;
        }
        try {
            await this.redisCacheService.del(this.buildSessionKey(payload.sid));
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException) {
                return;
            }
            throw error;
        }
    }
    buildSessionKey(sessionId) {
        return `${AUTH_SESSION_KEY_PREFIX}:${sessionId}`;
    }
    hashToken(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    parseSession(value) {
        try {
            const parsedValue = JSON.parse(value);
            if (typeof parsedValue.sid !== 'string' ||
                typeof parsedValue.sub !== 'string' ||
                typeof parsedValue.user_name !== 'string' ||
                typeof parsedValue.token_hash !== 'string' ||
                typeof parsedValue.refresh_token_hash !== 'string' ||
                typeof parsedValue.exp !== 'number' ||
                typeof parsedValue.iat !== 'number') {
                return null;
            }
            return parsedValue;
        }
        catch {
            return null;
        }
    }
};
exports.AuthSessionService = AuthSessionService;
exports.AuthSessionService = AuthSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_cache_service_1.RedisCacheService])
], AuthSessionService);
//# sourceMappingURL=auth-session.service.js.map