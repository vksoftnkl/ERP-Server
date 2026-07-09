import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
export type AccessTokenClaims = {
  sub: string;
  user_name: string;
  sid: string;
  // Authorization context resolved server-side at sign time. Nullable so tokens
  // issued before these claims existed keep verifying (they normalize to null).
  user_type: string | null;
  company_id: string | null;
};
export type AccessTokenPayload = AccessTokenClaims & {
  iat: number;
  exp: number;
  typ: 'access';
};
export type RefreshTokenPayload = AccessTokenClaims & {
  iat: number;
  exp: number;
  typ: 'refresh';
};
export type SignedAccessToken = {
  token: string;
  payload: AccessTokenPayload;
};
export type SignedRefreshToken = {
  token: string;
  payload: RefreshTokenPayload;
};
@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('auth.jwtSecret', '');
    this.accessTokenTtlSeconds = this.configService.get<number>('auth.accessTokenTtlSeconds', 15 * 60);
    this.refreshTokenTtlSeconds = this.configService.get<number>(
      'auth.refreshTokenTtlSeconds',
      7 * 24 * 60 * 60,
    );
  }
  signAccessToken(claims: AccessTokenClaims): SignedAccessToken {
    return this.signToken(claims, 'access', this.accessTokenTtlSeconds);
  }
  signRefreshToken(claims: AccessTokenClaims): SignedRefreshToken {
    return this.signToken(claims, 'refresh', this.refreshTokenTtlSeconds);
  }
  private signToken<TType extends 'access' | 'refresh'>(
    claims: AccessTokenClaims,
    tokenType: TType,
    ttlSeconds: number,
  ): TType extends 'access' ? SignedAccessToken : SignedRefreshToken {
    if (!this.secret) {
      throw new InternalServerErrorException('JWT secret is not configured');
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
    const signature = createHmac('sha256', this.secret).update(unsignedToken).digest('base64url');
    return ({
      token: `${unsignedToken}.${signature}`,
      payload,
    } as unknown) as TType extends 'access' ? SignedAccessToken : SignedRefreshToken;
  }
  verifyAccessToken(token: string): AccessTokenPayload {
    return this.verifyToken(token, 'access');
  }
  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.verifyToken(token, 'refresh');
  }
  private verifyToken<TType extends 'access' | 'refresh'>(
    token: string,
    expectedType: TType,
  ): TType extends 'access' ? AccessTokenPayload : RefreshTokenPayload {
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
    return this.validatePayload(payloadRecord, expectedType) as TType extends 'access'
      ? AccessTokenPayload
      : RefreshTokenPayload;
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
  private validatePayload(
    payload: Record<string, unknown>,
    expectedType: 'access' | 'refresh',
  ): AccessTokenPayload | RefreshTokenPayload {
    const sub = payload.sub;
    const userName = payload.user_name;
    const sessionId = payload.sid;
    const issuedAt = payload.iat;
    const expiresAt = payload.exp;
    const tokenType = payload.typ;
    const userType = payload.user_type;
    const companyId = payload.company_id;
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
    if (
      typeof expiresAt !== 'number' ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= issuedAt ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (tokenType !== expectedType) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (userType !== undefined && userType !== null && typeof userType !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }
    if (companyId !== undefined && companyId !== null && typeof companyId !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }
    const normalizedPayload = {
      sub,
      user_name: userName,
      sid: sessionId,
      user_type: typeof userType === 'string' && userType.length > 0 ? userType : null,
      company_id: typeof companyId === 'string' && companyId.length > 0 ? companyId : null,
      iat: issuedAt,
      exp: expiresAt,
      typ: expectedType,
    };
    return normalizedPayload;
  }
}