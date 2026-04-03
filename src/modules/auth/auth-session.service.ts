import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { AccessTokenPayload } from './token.service';

type CachedAccessTokenSession = {
  sid: string;
  sub: string;
  user_name: string;
  token_hash: string;
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

  async storeAccessTokenSession(token: string, payload: AccessTokenPayload): Promise<void> {
    if (!this.redisCacheService.isEnabled()) {
      return;
    }

    const ttlSeconds = Math.max(payload.exp - Math.floor(Date.now() / 1000), 1);
    const session: CachedAccessTokenSession = {
      sid: payload.sid,
      sub: payload.sub,
      user_name: payload.user_name,
      token_hash: this.hashToken(token),
      iat: payload.iat,
      exp: payload.exp,
    };

    try {
      await this.redisCacheService.set(
        this.buildSessionKey(payload.sid),
        JSON.stringify(session),
        ttlSeconds,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return;
      }

      throw error;
    }
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
      cachedSession.exp !== payload.exp ||
      cachedSession.token_hash !== this.hashToken(token)
    ) {
      throw new UnauthorizedException('Access token is no longer active');
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
        typeof parsedValue.iat !== 'number' ||
        typeof parsedValue.exp !== 'number'
      ) {
        return null;
      }

      return parsedValue as CachedAccessTokenSession;
    } catch {
      return null;
    }
  }
}
