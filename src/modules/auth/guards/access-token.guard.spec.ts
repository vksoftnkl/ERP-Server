import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../../../common/decorators/optional-auth.decorator';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import type { AuthEpochService } from '../../app-version/services/auth-epoch.service';
import type { AuthSessionService } from '../auth-session.service';
import type { AccessTokenPayload, TokenService } from '../token.service';
import { AccessTokenGuard } from './access-token.guard';

const CLAIMS = {
  sub: '019e441b-6e48-7918-b246-b857ffb35db1',
  user_type: 'SUPER ADMIN',
  company_id: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branch_id: null,
  device_id: null,
} as unknown as AccessTokenPayload;

function contextFor(
  meta: { public?: boolean; optional?: boolean },
  authorization?: string,
): ExecutionContext {
  const handler = (): void => undefined;
  if (meta.public) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  if (meta.optional) Reflect.defineMetadata(IS_OPTIONAL_AUTH_KEY, true, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', headers: authorization ? { authorization } : {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  let verifyAccessToken: jest.Mock;
  let assertActive: jest.Mock;
  let setUserId: jest.Mock;
  let setCompanyId: jest.Mock;
  let guard: AccessTokenGuard;

  beforeEach(() => {
    verifyAccessToken = jest.fn().mockReturnValue(CLAIMS);
    assertActive = jest.fn().mockResolvedValue(undefined);
    setUserId = jest.fn();
    setCompanyId = jest.fn();
    guard = new AccessTokenGuard(
      new Reflector(),
      { verifyAccessToken } as unknown as TokenService,
      { assertAccessTokenIsActive: assertActive } as unknown as AuthSessionService,
      {
        setUserId,
        setUserType: jest.fn(),
        setCompanyId,
        setBranchId: jest.fn(),
        setDeviceId: jest.fn(),
      } as unknown as RequestContextService,
      { assertTokenEpoch: jest.fn() } as unknown as AuthEpochService,
    );
  });

  it('refuses a normal route without a token', async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets a @Public route through without reading the token', async () => {
    await expect(guard.canActivate(contextFor({ public: true }, 'Bearer abc'))).resolves.toBe(true);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('@OptionalAuth with no Authorization header: anonymous, no user or company set', async () => {
    await expect(guard.canActivate(contextFor({ optional: true }))).resolves.toBe(true);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(setUserId).not.toHaveBeenCalled();
    expect(setCompanyId).not.toHaveBeenCalled();
  });

  it('@OptionalAuth with a token: checked and read like any route', async () => {
    await expect(guard.canActivate(contextFor({ optional: true }, 'Bearer abc'))).resolves.toBe(
      true,
    );
    expect(verifyAccessToken).toHaveBeenCalledWith('abc');
    expect(assertActive).toHaveBeenCalled();
    expect(setUserId).toHaveBeenCalledWith(CLAIMS.sub);
    expect(setCompanyId).toHaveBeenCalledWith(CLAIMS.company_id);
  });

  it('@OptionalAuth still refuses a malformed or bad token', async () => {
    await expect(
      guard.canActivate(contextFor({ optional: true }, 'Basic abc')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    verifyAccessToken.mockImplementation(() => {
      throw new UnauthorizedException('expired');
    });
    await expect(
      guard.canActivate(contextFor({ optional: true }, 'Bearer old')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
