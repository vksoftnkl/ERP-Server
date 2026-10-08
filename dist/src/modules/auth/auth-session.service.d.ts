import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { AccessTokenPayload, RefreshTokenPayload } from './token.service';
export declare class AuthSessionService {
    private readonly redisCacheService;
    constructor(redisCacheService: RedisCacheService);
    createSessionId(): string;
    storeTokenSession(accessToken: string, accessTokenPayload: AccessTokenPayload, refreshToken: string): Promise<void>;
    storeAccessTokenSession(token: string, payload: AccessTokenPayload): Promise<void>;
    assertAccessTokenIsActive(token: string, payload: AccessTokenPayload): Promise<void>;
    assertRefreshTokenIsActive(token: string, payload: RefreshTokenPayload): Promise<void>;
    revokeAccessTokenSession(payload: AccessTokenPayload): Promise<void>;
    private buildSessionKey;
    private hashToken;
    private parseSession;
}
