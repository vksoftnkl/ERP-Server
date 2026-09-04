import { UnauthorizedException } from '@nestjs/common';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { AuthSessionService } from './auth-session.service';
import { AccessTokenPayload } from './token.service';

type RedisCacheServiceMock = {
  isEnabled: jest.Mock<boolean, []>;
  set: jest.Mock<Promise<void>, [string, string, (number | null | undefined)?]>;
  get: jest.Mock<Promise<string | null>, [string]>;
  del: jest.Mock<Promise<number>, [string]>;
};

const buildPayload = (): AccessTokenPayload => {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: '7a9a4d16-9940-4b65-a7bc-57e83887a112',
    user_name: 'john.doe',
    sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
    user_type: 'USER',
    company_id: null,
    branch_id: null,
    device_id: null,
    iat: now,
    exp: now + 900,
    typ: 'access',
  };
};

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let redisCacheService: RedisCacheServiceMock;

  beforeEach(() => {
    redisCacheService = {
      isEnabled: jest.fn<boolean, []>().mockReturnValue(true),
      set: jest
        .fn<Promise<void>, [string, string, (number | null | undefined)?]>()
        .mockResolvedValue(undefined),
      get: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
      del: jest.fn<Promise<number>, [string]>().mockResolvedValue(1),
    };

    service = new AuthSessionService(redisCacheService as unknown as RedisCacheService);
  });

  it('stores the access token session in Redis without a ttl', async () => {
    const payload = buildPayload();

    await service.storeAccessTokenSession('signed-jwt-token', payload);

    expect(redisCacheService.set).toHaveBeenCalledTimes(1);
    const [key, value, ttlSeconds] = redisCacheService.set.mock.calls[0];
    expect(key).toBe(`auth:session:${payload.sid}`);
    expect(ttlSeconds).toBeUndefined();
    const storedSession = JSON.parse(value) as Record<string, unknown>;
    expect(storedSession.sub).toBe(payload.sub);
    expect(storedSession.user_name).toBe(payload.user_name);
    expect(storedSession.sid).toBe(payload.sid);
    expect(storedSession.exp).toBe(payload.exp);
    expect(storedSession.token_hash).toEqual(expect.any(String));
    expect(storedSession.refresh_token_hash).toEqual(expect.any(String));
  });

  it('rejects access tokens that are no longer present in Redis', async () => {
    const payload = buildPayload();
    redisCacheService.get.mockResolvedValue(null);

    await expect(
      service.assertAccessTokenIsActive('signed-jwt-token', payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects access tokens whose Redis session hash does not match', async () => {
    const payload = buildPayload();
    redisCacheService.get.mockResolvedValue(
      JSON.stringify({
        ...payload,
        token_hash: 'mismatched-token-hash',
      }),
    );

    await expect(
      service.assertAccessTokenIsActive('signed-jwt-token', payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('skips Redis storage and validation when the cache feature is disabled', async () => {
    const payload = buildPayload();
    redisCacheService.isEnabled.mockReturnValue(false);

    await service.storeAccessTokenSession('signed-jwt-token', payload);
    await expect(
      service.assertAccessTokenIsActive('signed-jwt-token', payload),
    ).resolves.toBeUndefined();

    expect(redisCacheService.set).not.toHaveBeenCalled();
    expect(redisCacheService.get).not.toHaveBeenCalled();
  });
});
