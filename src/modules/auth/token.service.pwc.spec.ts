import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { TokenService } from './token.service';

/** Review step 6 (U8): the `pwc` claim survives a sign / verify and is absent otherwise. */
describe('TokenService pwc claim', () => {
  const secret = 'unit-test-secret';
  const service = new TokenService({
    get: (key: string, fallback?: unknown) => (key === 'auth.jwtSecret' ? secret : fallback),
  } as unknown as ConfigService);
  const claims = {
    sub: '019c6f6c-be87-7a11-8905-36092c46f401',
    user_name: 'zt',
    sid: 'sid',
    user_type: null,
    company_id: null,
    branch_id: null,
    device_id: null,
  };

  it('a must-change token keeps pwc: true through verify', () => {
    const { token } = service.signAccessToken({ ...claims, pwc: true });
    expect(service.verifyAccessToken(token).pwc).toBe(true);
  });

  it('every other token carries no pwc key at all', () => {
    const { token } = service.signAccessToken(claims);
    expect(service.verifyAccessToken(token)).not.toHaveProperty('pwc');
    const { token: refresh } = service.signRefreshToken({ ...claims, pwc: false });
    expect(service.verifyRefreshToken(refresh)).not.toHaveProperty('pwc');
  });

  it('a pwc that is not a boolean is an invalid token', () => {
    const now = Math.floor(Date.now() / 1000);
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({
      ...claims,
      pwc: 'yes',
      iat: now,
      exp: now + 60,
      typ: 'access',
    })}`;
    const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });
});
