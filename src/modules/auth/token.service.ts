import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type AccessTokenClaims = {
  sub: string;
  user_name: string;
  sid: string;
};

export type AccessTokenPayload = AccessTokenClaims & {
  iat: number;
  exp: number;
};

export type SignedAccessToken = {
  token: string;
  payload: AccessTokenPayload;
};

@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly accessTokenTtlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('auth.jwtSecret', '');
    this.accessTokenTtlSeconds = this.configService.get<number>(
      'auth.accessTokenTtlSeconds',
      3600,
    );
  }

  signAccessToken(claims: AccessTokenClaims): SignedAccessToken {
    if (!this.secret) {
      throw new InternalServerErrorException('JWT secret is not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      ...claims,
      iat: now,
      exp: now + this.accessTokenTtlSeconds,
    };

    const headerSegment = this.encodeBase64Url({
      alg: 'HS256',
      typ: 'JWT',
    });
    const payloadSegment = this.encodeBase64Url(payload);
    const unsignedToken = `${headerSegment}.${payloadSegment}`;
    const signature = createHmac('sha256', this.secret).update(unsignedToken).digest('base64url');

    return {
      token: `${unsignedToken}.${signature}`,
      payload,
    };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    if (!this.secret) {
      throw new InternalServerErrorException('JWT secret is not configured');
    }

    const tokenSegments = token.split('.');
    if (tokenSegments.length !== 3) {
      throw new UnauthorizedException('Invalid access token');
    }

    const [headerSegment, payloadSegment, signatureSegment] = tokenSegments;
    const header = this.decodeSegment<Record<string, unknown>>(headerSegment);
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new UnauthorizedException('Invalid access token');
    }

    const unsignedToken = `${headerSegment}.${payloadSegment}`;
    const expectedSignature = createHmac('sha256', this.secret)
      .update(unsignedToken)
      .digest('base64url');
    if (!this.compareSignatures(signatureSegment, expectedSignature)) {
      throw new UnauthorizedException('Invalid access token');
    }

    const payloadRecord = this.decodeSegment<Record<string, unknown>>(payloadSegment);
    return this.validatePayload(payloadRecord);
  }

  private encodeBase64Url(data: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  private decodeSegment<T>(segment: string): T {
    try {
      const json = Buffer.from(segment, 'base64url').toString('utf8');
      return JSON.parse(json) as T;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private compareSignatures(receivedSignature: string, expectedSignature: string): boolean {
    const receivedBuffer = Buffer.from(receivedSignature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  private validatePayload(payload: Record<string, unknown>): AccessTokenPayload {
    const sub = payload.sub;
    const userName = payload.user_name;
    const sessionId = payload.sid;
    const issuedAt = payload.iat;
    const expiresAt = payload.exp;

    if (typeof sub !== 'string' || sub.length === 0) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (typeof userName !== 'string' || userName.length === 0) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (
      typeof issuedAt !== 'number' ||
      !Number.isInteger(issuedAt) ||
      issuedAt < 0
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (typeof expiresAt !== 'number' || !Number.isInteger(expiresAt) || expiresAt <= issuedAt) {
      throw new UnauthorizedException('Invalid access token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (expiresAt <= now) {
      throw new UnauthorizedException('Access token expired');
    }

    const normalizedPayload: AccessTokenPayload = {
      sub,
      user_name: userName,
      sid: sessionId,
      iat: issuedAt,
      exp: expiresAt,
    };

    return normalizedPayload;
  }
}
