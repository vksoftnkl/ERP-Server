import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { AccessTokenPayload, RefreshTokenPayload } from './token.service';

type CachedAccessTokenSession = {
  sid: string;
  sub: string;
  user_name: string;
  token_hash: string;
  refresh_token_hash: string;
  iat: number;
  exp: number;
};

const AUTH_SESSION_KEY_PREFIX = 'auth:session';

@Injectable()
export class AuthSessionService {
  constructor(private readonly redisCacheService: RedisCacheService) {}

  createSessionId(): string {
    return randomUUID();
  }

  async storeTokenSession(
    accessToken: string,
    accessTokenPayload: AccessTokenPayload,
    refreshToken: string,
  ): Promise<void> {
    if (!this.redisCacheService.isEnabled()) {
      return;
    }

    const session: CachedAccessTokenSession = {
      sid: accessTokenPayload.sid,
      sub: accessTokenPayload.sub,
      user_name: accessTokenPayload.user_name,
      token_hash: this.hashToken(accessToken),
      refresh_token_hash: this.hashToken(refreshToken),
      iat: accessTokenPayload.iat,
      exp: accessTokenPayload.exp,
    };

    try {
      await this.redisCacheService.set(
        this.buildSessionKey(accessTokenPayload.sid),
        JSON.stringify(session),
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return;
      }

      throw error;
    }
  }

  async storeAccessTokenSession(token: string, payload: AccessTokenPayload): Promise<void> {
    await this.storeTokenSession(token, payload, '');
  }

  async assertAccessTokenIsActive(token: string, payload: AccessTokenPayload): Promise<void> {
    if (!this.redisCacheService.isEnabled()) {
      return;
    }

    let cachedSessionValue: string | null;
    try {
      cachedSessionValue = await this.redisCacheService.get(this.buildSessionKey(payload.sid));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return;
      }

      throw error;
    }

    if (!cachedSessionValue) {
      throw new UnauthorizedException('Access token is no longer active');
    }

    const cachedSession = this.parseSession(cachedSessionValue);
    if (!cachedSession) {
      throw new UnauthorizedException('Access token session is invalid');
    }

    if (
      cachedSession.sid !== payload.sid ||
      cachedSession.sub !== payload.sub ||
      cachedSession.user_name !== payload.user_name ||
      cachedSession.token_hash !== this.hashToken(token)
    ) {
      throw new UnauthorizedException('Access token is no longer active');
    }
  }

  async assertRefreshTokenIsActive(token: string, payload: RefreshTokenPayload): Promise<void> {
    if (!this.redisCacheService.isEnabled()) {
      return;
    }

    let cachedSessionValue: string | null;
    try {
      cachedSessionValue = await this.redisCacheService.get(this.buildSessionKey(payload.sid));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return;
      }

      throw error;
    }

    if (!cachedSessionValue) {
      throw new UnauthorizedException('Refresh token is no longer active');
    }

    const cachedSession = this.parseSession(cachedSessionValue);
    if (!cachedSession) {
      throw new UnauthorizedException('Refresh token session is invalid');
    }

    if (
      cachedSession.sid !== payload.sid ||
      cachedSession.sub !== payload.sub ||
      cachedSession.user_name !== payload.user_name ||
      cachedSession.refresh_token_hash !== this.hashToken(token)
    ) {
      throw new UnauthorizedException('Refresh token is no longer active');
    }
  }

  async revokeAccessTokenSession(payload: AccessTokenPayload): Promise<void> {
    if (!this.redisCacheService.isEnabled()) {
      return;
    }

    try {
      await this.redisCacheService.del(this.buildSessionKey(payload.sid));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return;
      }

      throw error;
    }
  }

  private buildSessionKey(sessionId: string): string {
    return `${AUTH_SESSION_KEY_PREFIX}:${sessionId}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseSession(value: string): CachedAccessTokenSession | null {
    try {
      const parsedValue = JSON.parse(value) as Partial<CachedAccessTokenSession>;
      if (
        typeof parsedValue.sid !== 'string' ||
        typeof parsedValue.sub !== 'string' ||
        typeof parsedValue.user_name !== 'string' ||
        typeof parsedValue.token_hash !== 'string' ||
        typeof parsedValue.refresh_token_hash !== 'string' ||
        typeof parsedValue.exp !== 'number' ||
        typeof parsedValue.iat !== 'number'
      ) {
        return null;
      }

      return parsedValue as CachedAccessTokenSession;
    } catch {
      return null;
    }
  }
}
