import { HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashSecret } from '../../common/utils/secret-hash.utils';
import { AuthService } from './auth.service';
import { AuthErrorCode } from './types/auth-error-codes';

/**
 * Review step 6 (U8 / U9, user 20/11): the login tells the real reason ONLY after the
 * password is proved right (inactive or deleted → AUTH_USER_INACTIVE, locked →
 * AUTH_USER_LOCKED, channel off → AUTH_CHANNEL_DISABLED + `channel`); a wrong password or an
 * unknown name stays AUTH_INVALID_CREDENTIALS; the failed counter moves exactly as before
 * (only for an account the old filter let through); a reset password answers
 * mustChangePassword: true and marks the tokens `pwc`; a refresh keeps `pwc` only while the
 * flag stands.
 */
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f301';
const RIGHT = 'Right123';
const WRONG = 'Wrong123';

async function refusalOf(
  promise: Promise<unknown>,
): Promise<{ status: number; error: Record<string, unknown> }> {
  const caught = await promise.then(
    () => {
      throw new Error('expected the login to be refused');
    },
    (e: unknown) => e,
  );
  if (!(caught instanceof HttpException)) throw caught;
  const body = caught.getResponse() as { errors: Record<string, unknown>[] };
  return { status: caught.getStatus(), error: body.errors[0] };
}

describe('AuthService login state (review step 6)', () => {
  let hash: string;
  let prisma: {
    userMaster: { findFirst: jest.Mock; update: jest.Mock };
    userLoginSession: { create: jest.Mock };
  };
  let signAccess: jest.Mock;
  let signRefresh: jest.Mock;
  let service: AuthService;
  let warn: jest.SpyInstance;

  const user = (overrides: Record<string, unknown> = {}) => ({
    usrId: USER_ID,
    usrLoginName: 'zt.cashier',
    usrType: 'CASHIER',
    usrCompanyId: null,
    usrBranchId: null,
    usrPasswordHash: hash,
    usrIsDeleted: false,
    usrIsActive: true,
    usrIsLocked: false,
    usrDesktopLogin: true,
    usrWebLogin: true,
    usrMobileLogin: true,
    usrMustChangePassword: false,
    ...overrides,
  });

  beforeAll(async () => {
    hash = await hashSecret(RIGHT);
  });

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = {
      userMaster: {
        findFirst: jest.fn().mockResolvedValue(user()),
        update: jest.fn().mockResolvedValue({}),
      },
      userLoginSession: { create: jest.fn().mockResolvedValue({}) },
    };
    const signed = (typ: string) => (claims: Record<string, unknown>) => ({
      token: `${typ}-token`,
      payload: { ...claims, iat: 1, exp: 2, typ },
    });
    signAccess = jest.fn(signed('access'));
    signRefresh = jest.fn(signed('refresh'));
    service = new AuthService(
      {
        signAccessToken: signAccess,
        signRefreshToken: signRefresh,
        verifyRefreshToken: jest.fn(),
      } as never,
      {
        createSessionId: () => 'sid-1',
        storeTokenSession: jest.fn().mockResolvedValue(undefined),
        assertRefreshTokenIsActive: jest.fn().mockResolvedValue(undefined),
      } as never,
      prisma as never,
      { getIpAddress: () => '127.0.0.1' } as never,
      {
        onLogin: jest.fn().mockResolvedValue(null),
        onRefresh: jest.fn().mockResolvedValue(undefined),
        legacyField: jest.fn(),
      } as never,
      { assertClientBuild: jest.fn() } as never,
      { current: () => 0, assertTokenEpoch: jest.fn() } as never,
      { logEntityChange: jest.fn() } as never,
    );
  });

  afterEach(() => warn.mockRestore());

  const login = (password: string, deviceType?: string) =>
    service.login({
      usrLoginName: ' ZT.Cashier ',
      usrPassword: password,
      ...(deviceType ? { device_type: deviceType } : {}),
    });

  it('finds the user by name whatever its state, a live row before a deleted one', async () => {
    await login(RIGHT);
    expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
      where: { usrLoginName: { equals: 'ZT.Cashier', mode: 'insensitive' } },
      orderBy: [
        { usrIsDeleted: 'asc' },
        { usrModifiedOn: { sort: 'desc', nulls: 'last' } },
        { usrCreatedOn: 'desc' },
      ],
    });
  });

  it('an unknown name is AUTH_INVALID_CREDENTIALS, as before', async () => {
    prisma.userMaster.findFirst.mockResolvedValue(null);
    const { status, error } = await refusalOf(login(RIGHT));
    expect(status).toBe(401);
    expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
  });

  it('a wrong password on a usable account is AUTH_INVALID_CREDENTIALS and counts a failure', async () => {
    const { status, error } = await refusalOf(login(WRONG));
    expect(status).toBe(401);
    expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    expect(prisma.userMaster.update).toHaveBeenCalledWith({
      where: { usrId: USER_ID },
      data: { usrFailedLoginCount: { increment: 1 }, usrLastFailedLoginOn: expect.any(Date) },
    });
  });

  it.each([
    ['inactive', { usrIsActive: false }],
    ['deleted', { usrIsDeleted: true, usrIsActive: false }],
    ['locked', { usrIsLocked: true }],
    ['desktop off', { usrDesktopLogin: false }],
  ])(
    'a wrong password on a %s account says nothing more and counts nothing (as before)',
    async (_label, overrides) => {
      prisma.userMaster.findFirst.mockResolvedValue(user(overrides));
      const { status, error } = await refusalOf(login(WRONG, 'PC'));
      expect(status).toBe(401);
      expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(prisma.userMaster.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['inactive', { usrIsActive: false }, AuthErrorCode.USER_INACTIVE],
    [
      'deleted (never worded "deleted")',
      { usrIsDeleted: true, usrIsActive: false },
      AuthErrorCode.USER_INACTIVE,
    ],
    ['deleted but flagged active', { usrIsDeleted: true }, AuthErrorCode.USER_INACTIVE],
    ['locked', { usrIsLocked: true }, AuthErrorCode.USER_LOCKED],
    [
      'inactive AND locked: inactive first',
      { usrIsActive: false, usrIsLocked: true },
      AuthErrorCode.USER_INACTIVE,
    ],
  ])('the right password on a %s account is told why (401)', async (_label, overrides, code) => {
    prisma.userMaster.findFirst.mockResolvedValue(user(overrides));
    const { status, error } = await refusalOf(login(RIGHT));
    expect(status).toBe(401);
    expect(error.code).toBe(code);
    expect(String(error.message).toLowerCase()).not.toContain('deleted');
    expect(signAccess).not.toHaveBeenCalled();
    expect(prisma.userMaster.update).not.toHaveBeenCalled();
  });

  it.each([
    ['PC', { usrDesktopLogin: false }, 'desktop'],
    ['web', { usrWebLogin: false }, 'web'],
    ['android', { usrMobileLogin: false }, 'mobile'],
  ])(
    'the right password from %s with that channel off: AUTH_CHANNEL_DISABLED, channel %s',
    async (deviceType, overrides, channel) => {
      prisma.userMaster.findFirst.mockResolvedValue(user(overrides));
      const { status, error } = await refusalOf(login(RIGHT, deviceType));
      expect(status).toBe(401);
      expect(error).toMatchObject({ code: AuthErrorCode.CHANNEL_DISABLED, channel });
    },
  );

  it('no device type and every channel off: AUTH_CHANNEL_DISABLED with no channel', async () => {
    prisma.userMaster.findFirst.mockResolvedValue(
      user({ usrDesktopLogin: false, usrWebLogin: false, usrMobileLogin: false }),
    );
    const { error } = await refusalOf(login(RIGHT));
    expect(error.code).toBe(AuthErrorCode.CHANNEL_DISABLED);
    expect(error).not.toHaveProperty('channel');
  });

  it('no device type and one channel open logs in', async () => {
    prisma.userMaster.findFirst.mockResolvedValue(
      user({ usrDesktopLogin: false, usrWebLogin: false }),
    );
    await expect(login(RIGHT)).resolves.toMatchObject({ usrId: USER_ID });
  });

  it('a normal login answers mustChangePassword false and no pwc claim', async () => {
    const answer = await login(RIGHT);
    expect(answer.mustChangePassword).toBe(false);
    expect(signAccess.mock.calls[0][0]).not.toHaveProperty('pwc');
    expect(signRefresh.mock.calls[0][0]).not.toHaveProperty('pwc');
  });

  it('a reset password answers mustChangePassword true and marks both tokens pwc', async () => {
    prisma.userMaster.findFirst.mockResolvedValue(user({ usrMustChangePassword: true }));
    const answer = await login(RIGHT);
    expect(answer.mustChangePassword).toBe(true);
    expect(signAccess.mock.calls[0][0]).toMatchObject({ pwc: true });
    expect(signRefresh.mock.calls[0][0]).toMatchObject({ pwc: true });
  });

  it("answers the user's own rate / discount lock: usrEditRate and usrMaxDiscPerc (decimal string)", async () => {
    expect(await login(RIGHT)).toMatchObject({ usrEditRate: false, usrMaxDiscPerc: null });
    prisma.userMaster.findFirst.mockResolvedValue(
      user({ usrEditRate: true, usrMaxDiscPerc: new Prisma.Decimal('12.5') }),
    );
    expect(await login(RIGHT)).toMatchObject({ usrEditRate: true, usrMaxDiscPerc: '12.50' });
  });

  describe('refresh', () => {
    const refreshWith = async (pwc: boolean | undefined, flag: boolean) => {
      const verify = (service as unknown as { tokenService: { verifyRefreshToken: jest.Mock } })
        .tokenService.verifyRefreshToken;
      verify.mockReturnValue({
        sub: USER_ID,
        user_name: 'zt.cashier',
        sid: 'sid-1',
        user_type: 'CASHIER',
        company_id: null,
        branch_id: null,
        device_id: null,
        ep: 0,
        platform: null,
        ...(pwc === undefined ? {} : { pwc }),
      });
      prisma.userMaster.findFirst.mockResolvedValue({
        usrType: 'CASHIER',
        usrCompanyId: null,
        usrMustChangePassword: flag,
      });
      return service.refresh('refresh-token');
    };

    it("re-reads the user's own rate / discount lock", async () => {
      const verify = (service as unknown as { tokenService: { verifyRefreshToken: jest.Mock } })
        .tokenService.verifyRefreshToken;
      verify.mockReturnValue({ sub: USER_ID, user_name: 'zt.cashier', sid: 'sid-1', ep: 0 });
      prisma.userMaster.findFirst.mockReset().mockResolvedValue({
        usrType: 'CASHIER',
        usrCompanyId: null,
        usrMustChangePassword: false,
        usrEditRate: false,
        usrMaxDiscPerc: new Prisma.Decimal(7),
      });
      expect(await service.refresh('refresh-token')).toMatchObject({
        usrEditRate: false,
        usrMaxDiscPerc: '7.00',
      });
      expect(prisma.userMaster.findFirst.mock.calls[0][0].select).toMatchObject({
        usrEditRate: true,
        usrMaxDiscPerc: true,
      });
    });

    it('keeps pwc while the password is not changed', async () => {
      const answer = await refreshWith(true, true);
      expect(answer.mustChangePassword).toBe(true);
      expect(signAccess.mock.calls[0][0]).toMatchObject({ pwc: true });
    });

    it('drops pwc once the password was changed', async () => {
      const answer = await refreshWith(true, false);
      expect(answer.mustChangePassword).toBe(false);
      expect(signAccess.mock.calls[0][0]).not.toHaveProperty('pwc');
    });

    it('never turns a normal session into a must-change one (an admin reset waits for the next login)', async () => {
      const answer = await refreshWith(undefined, true);
      expect(answer.mustChangePassword).toBe(false);
      expect(signAccess.mock.calls[0][0]).not.toHaveProperty('pwc');
    });
  });
});
