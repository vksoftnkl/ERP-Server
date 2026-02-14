import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

type AccessTokenClaims = {
  sub: string;
  user_name: string;
};

@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly accessTokenLifetimeSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('auth.jwtSecret', '');
    this.accessTokenLifetimeSeconds = this.configService.get<number>('auth.jwtExpiresIn', 3600);
  }

  signAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number } {
    if (!this.secret) {
      throw new InternalServerErrorException('JWT secret is not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      ...claims,
      iat: now,
      exp: now + this.accessTokenLifetimeSeconds,
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
      expiresIn: this.accessTokenLifetimeSeconds,
    };
  }

  private encodeBase64Url(data: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }
}
