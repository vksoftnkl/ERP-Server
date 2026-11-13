import { HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import { UserMaster } from '@prisma/client';
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { parseClientInfo } from '../../common/client-info/client-info';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AppUpdateService } from '../app-version/services/app-update.service';
import type {
  AppVersionStateStore,
  BuildPolicy,
} from '../app-version/services/app-version-state.store';
import { AuthEpochService } from '../app-version/services/auth-epoch.service';
import { BuildPolicyService } from '../app-version/services/build-policy.service';
import type { ClientInstallationService } from '../app-version/services/client-installation.service';
import { ClientTrackingService } from '../app-version/services/client-tracking.service';
import type { LegacyUsageService } from '../app-version/services/legacy-usage.service';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
const scryptAsync = promisify(nodeScrypt);
const TEST_USER_ID = '7a9a4d16-9940-4b65-a7bc-57e83887a112';
const TEST_COMPANY_ID = '73085398-6f07-4dde-9a4c-8264df7077e1';
const TEST_BRANCH_ID = 'a67885f8-0871-498d-af97-d958cdd68113';
const TEST_TIMESTAMP = new Date('2026-03-20T00:00:00.000Z');
/** The login response before Part B: an old build must keep getting exactly this. */
const LEGACY_LOGIN_RESPONSE = {
  access_token: 'signed-jwt-token',
  refresh_token: 'signed-refresh-token',
  token_type: 'Bearer',
  usrId: TEST_USER_ID,
  user_type: 'USER',
  user_name: 'john.doe',
  device_id: null,
  device_name: null,
  dev_company_id: null,
  dev_branch_id: null,
  dev_user_id: null,
  device_type: null,
};
const UPDATE_NOTICE = {
  platform: 'desktop',
  currentBuild: 10,
  updateAvailable: true,
  severity: 'normal',
  latestBuild: 12,
  latestVersion: '1.2.0',
  downloadUrl: null,
  notes: null,
  releasedAt: '2026-11-10T10:00:00.000Z',
  missedBuilds: 1,
};
const NEW_BUILD_HEADERS = {
  'x-app-platform': 'desktop',
  'x-app-build': '10',
  'x-app-version': '1.2.0',
  'x-device-id': 'pc-1',
};
type TokenServiceMock = {
  signAccessToken: jest.Mock<
    {
      token: string;
      payload: {
        sub: string;
        user_name: string;
        sid: string;
        iat: number;
        exp: number;
        typ: 'access';
      };
    },
    [{ sub: string; user_name: string; sid: string }]
  >;
  signRefreshToken: jest.Mock<
    {
      token: string;
      payload: {
        sub: string;
        user_name: string;
        sid: string;
        iat: number;
        exp: number;
        typ: 'refresh';
      };
    },
    [{ sub: string; user_name: string; sid: string }]
  >;
};
type AuthSessionServiceMock = {
  createSessionId: jest.Mock<string, []>;
  storeAccessTokenSession: jest.Mock<
    Promise<void>,
    [
      string,
      { sub: string; user_name: string; sid: string; iat: number; exp: number; typ: 'access' },
    ]
  >;
  storeTokenSession: jest.Mock<
    Promise<void>,
    [
      string,
      { sub: string; user_name: string; sid: string; iat: number; exp: number; typ: 'access' },
      string,
    ]
  >;
};
type PrismaServiceMock = {
  userMaster: {
    findFirst: jest.Mock<Promise<UserMaster | null>, [unknown]>;
  };
  userLoginSession: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};
type RequestContextServiceMock = {
  getIpAddress: jest.Mock<string | null, []>;
};
const hashPasswordForTest = async (plainPassword: string): Promise<string> => {
  const salt = 'unit-test-salt';
  const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
};
const makeUser = (overrides: Partial<UserMaster> = {}): UserMaster => ({
  usrId: TEST_USER_ID,
  usrCompanyId: TEST_COMPANY_ID,
  usrBranchId: TEST_BRANCH_ID,
  usrEmployeeId: null,
  usrLoginName: 'john.doe',
  usrDisplayName: 'John Doe',
  usrFullName: 'John Doe',
  usrMobileNo: '9999999999',
  usrEmail: 'john.doe@example.com',
  usrAvatarUrl: null,
  usrTimezone: 'UTC',
  usrLanguage: 'en',
  usrPasswordHash: 'scrypt$unit-test-salt$invalid',
  usrPinHash: null,
  usrMustChangePassword: false,
  usrPasswordExpiresOn: null,
  usrPasswordChangedOn: null,
  usrType: 'USER',
  usrEditDate: false,
  usrEditEntry: false,
  usrEditRate: false,
  usrDesktopLogin: true,
  usrWebLogin: true,
  usrMobileLogin: false,
  usrIsActive: true,
  usrIsLocked: false,
  usrFailedLoginCount: 0,
  usrLastFailedLoginOn: null,
  usrLockedOn: null,
  usrLockedBy: null,
  usrLastLoginOn: null,
  usrIsDeleted: false,
  usrNotes: null,
  usrSyncDate: null,
  usrCreatedOn: TEST_TIMESTAMP,
  usrCreatedBy: null,
  usrModifiedOn: null,
  usrModifiedBy: null,
  ...overrides,
});
describe('AuthService', () => {
  let service: AuthService;
  let installations: { recordLogin: jest.Mock; recordRefresh: jest.Mock };
  let updates: { check: jest.Mock };
  let legacyUsage: { record: jest.Mock };
  let stateStore: { readPolicies: jest.Mock; readEpoch: jest.Mock };
  let buildPolicy: BuildPolicyService;
  let authEpoch: AuthEpochService;
  let tokenService: TokenServiceMock;
  let authSessionService: AuthSessionServiceMock;
  let prismaService: PrismaServiceMock;
  let requestContextService: RequestContextServiceMock;
  beforeEach(() => {
    tokenService = {
      signAccessToken: jest
        .fn<
          {
            token: string;
            payload: {
              sub: string;
              user_name: string;
              sid: string;
              iat: number;
              exp: number;
              typ: 'access';
            };
          },
          [{ sub: string; user_name: string; sid: string }]
        >()
        .mockReturnValue({
          token: 'signed-jwt-token',
          payload: {
            sub: TEST_USER_ID,
            user_name: 'john.doe',
            sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
            iat: 1_710_979_200,
            exp: 1_710_980_100,
            typ: 'access',
          },
        }),
      signRefreshToken: jest
        .fn<
          {
            token: string;
            payload: {
              sub: string;
              user_name: string;
              sid: string;
              iat: number;
              exp: number;
              typ: 'refresh';
            };
          },
          [{ sub: string; user_name: string; sid: string }]
        >()
        .mockReturnValue({
          token: 'signed-refresh-token',
          payload: {
            sub: TEST_USER_ID,
            user_name: 'john.doe',
            sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
            iat: 1_710_979_200,
            exp: 1_711_584_000,
            typ: 'refresh',
          },
        }),
    };
    authSessionService = {
      createSessionId: jest
        .fn<string, []>()
        .mockReturnValue('4e457f70-cc9b-4e8f-b7e4-35cc3f588c22'),
      storeAccessTokenSession: jest
        .fn<
          Promise<void>,
          [
            string,
            {
              sub: string;
              user_name: string;
              sid: string;
              iat: number;
              exp: number;
              typ: 'access';
            },
          ]
        >()
        .mockResolvedValue(undefined),
      storeTokenSession: jest
        .fn<
          Promise<void>,
          [
            string,
            {
              sub: string;
              user_name: string;
              sid: string;
              iat: number;
              exp: number;
              typ: 'access';
            },
            string,
          ]
        >()
        .mockResolvedValue(undefined),
    };
    prismaService = {
      userMaster: {
        findFirst: jest.fn<Promise<UserMaster | null>, [unknown]>(),
      },
      userLoginSession: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
          ulsId: 'login-session-id',
        }),
      },
    };
    requestContextService = {
      getIpAddress: jest.fn<string | null, []>().mockReturnValue('127.0.0.1'),
    };

    installations = {
      recordLogin: jest.fn().mockResolvedValue(true),
      recordRefresh: jest.fn().mockResolvedValue(true),
    };
    updates = { check: jest.fn().mockResolvedValue(UPDATE_NOTICE) };
    legacyUsage = { record: jest.fn() };
    // Part B Step 2 Rev 2: the real policy + epoch services over a fake store.
    // Nothing enforced and epoch 0 unless a test says otherwise.
    stateStore = {
      readPolicies: jest.fn().mockResolvedValue([]),
      readEpoch: jest.fn().mockResolvedValue(0),
    };
    buildPolicy = new BuildPolicyService(stateStore as unknown as AppVersionStateStore);
    authEpoch = new AuthEpochService(stateStore as unknown as AppVersionStateStore);
    // The real tracking facade over mocked writers, so its "never throws" is
    // what these tests exercise.
    service = new AuthService(
      tokenService as unknown as TokenService,
      authSessionService as unknown as AuthSessionService,
      prismaService as unknown as PrismaService,
      requestContextService as unknown as RequestContextService,
      new ClientTrackingService(
        installations as unknown as ClientInstallationService,
        updates as unknown as AppUpdateService,
        legacyUsage as unknown as LegacyUsageService,
      ),
      buildPolicy,
      authEpoch,
    );
  });
  it('returns token when credentials are valid', async () => {
    const hashedPassword = await hashPasswordForTest('StrongPassword123!');
    prismaService.userMaster.findFirst.mockResolvedValue(
      makeUser({ usrLoginName: 'john.doe', usrPasswordHash: hashedPassword }),
    );
    await expect(
      service.login({
        usrLoginName: 'john.doe',
        usrPassword: 'StrongPassword123!',
      }),
    ).resolves.toEqual({
      access_token: 'signed-jwt-token',
      refresh_token: 'signed-refresh-token',
      token_type: 'Bearer',
      usrId: TEST_USER_ID,
      user_type: 'USER',
      user_name: 'john.doe',
      device_id: null,
      device_name: null,
      dev_company_id: null,
      dev_branch_id: null,
      dev_user_id: null,
      device_type: null,
    });
    expect(prismaService.userMaster.findFirst).toHaveBeenCalledWith({
      where: {
        usrLoginName: { equals: 'john.doe', mode: 'insensitive' },
        usrIsDeleted: false,
        usrIsActive: true,
        usrIsLocked: false,
        // no device type given: any channel open to the user will do
        OR: [{ usrWebLogin: true }, { usrDesktopLogin: true }, { usrMobileLogin: true }],
      },
    });
    expect(tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: TEST_USER_ID,
      user_name: 'john.doe',
      sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
      user_type: 'USER',
      company_id: TEST_COMPANY_ID,
      // no device matched this login, so the token carries no counter or branch
      branch_id: null,
      device_id: null,
      // Part B Step 2 Rev 2: epoch 0, and no platform (no header, no device_type)
      ep: 0,
      platform: null,
    });
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith({
      sub: TEST_USER_ID,
      user_name: 'john.doe',
      sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
      user_type: 'USER',
      company_id: TEST_COMPANY_ID,
      branch_id: null,
      device_id: null,
      ep: 0,
      platform: null,
    });
    expect(authSessionService.storeTokenSession).toHaveBeenCalledWith(
      'signed-jwt-token',
      {
        sub: TEST_USER_ID,
        user_name: 'john.doe',
        sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
        iat: 1_710_979_200,
        exp: 1_710_980_100,
        typ: 'access',
      },
      'signed-refresh-token',
    );
    expect(prismaService.userLoginSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ulsCompanyId: TEST_COMPANY_ID,
        ulsBranchId: TEST_BRANCH_ID,
        ulsUserId: TEST_USER_ID,
        ulsSessionId: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
        ulsIpAddress: '127.0.0.1',
        ulsLoginStatus: 'SUCCESS',
      }),
    });
  });
  it('throws unauthorized when username does not exist', async () => {
    prismaService.userMaster.findFirst.mockResolvedValue(null);
    await expect(
      service.login({
        usrLoginName: 'missing.user',
        usrPassword: 'StrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    expect(authSessionService.storeTokenSession).not.toHaveBeenCalled();
  });
  it('still returns token when login session persistence fails', async () => {
    const hashedPassword = await hashPasswordForTest('StrongPassword123!');
    prismaService.userMaster.findFirst.mockResolvedValue(
      makeUser({ usrLoginName: 'john.doe', usrPasswordHash: hashedPassword }),
    );
    prismaService.userLoginSession.create.mockRejectedValue(
      new Error('Null constraint violation on the fields: (`uls_branch_id`)'),
    );
    await expect(
      service.login({
        usrLoginName: 'john.doe',
        usrPassword: 'StrongPassword123!',
      }),
    ).resolves.toEqual({
      access_token: 'signed-jwt-token',
      refresh_token: 'signed-refresh-token',
      token_type: 'Bearer',
      usrId: TEST_USER_ID,
      user_type: 'USER',
      user_name: 'john.doe',
      device_id: null,
      device_name: null,
      dev_company_id: null,
      dev_branch_id: null,
      dev_user_id: null,
      device_type: null,
    });
    expect(authSessionService.storeTokenSession).toHaveBeenCalled();
    expect(prismaService.userLoginSession.create).toHaveBeenCalled();
  });
  it('throws unauthorized when password is invalid', async () => {
    const hashedPassword = await hashPasswordForTest('CorrectPassword123!');
    prismaService.userMaster.findFirst.mockResolvedValue(
      makeUser({ usrLoginName: 'john.doe', usrPasswordHash: hashedPassword }),
    );
    await expect(
      service.login({
        usrLoginName: 'john.doe',
        usrPassword: 'WrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    expect(authSessionService.storeTokenSession).not.toHaveBeenCalled();
  });
  describe('Part B Step 2: client build tracking', () => {
    const loginAs = async (headers: Record<string, string> | null, appVersion?: string) => {
      const hashedPassword = await hashPasswordForTest('StrongPassword123!');
      prismaService.userMaster.findFirst.mockResolvedValue(
        makeUser({ usrLoginName: 'john.doe', usrPasswordHash: hashedPassword }),
      );
      return service.login(
        {
          usrLoginName: 'john.doe',
          usrPassword: 'StrongPassword123!',
          ...(appVersion !== undefined && { app_version: appVersion }),
        },
        {
          userAgent: null,
          appVersion: null,
          client: headers === null ? null : parseClientInfo(headers),
        },
      );
    };

    it('an old build (no X-App-* headers) gets exactly the old response and is not recorded', async () => {
      const response = await loginAs({});
      expect(response).toEqual(LEGACY_LOGIN_RESPONSE);
      expect(Object.keys(response)).not.toContain('appUpdate');
      expect(installations.recordLogin).not.toHaveBeenCalled();
      expect(updates.check).not.toHaveBeenCalled();
    });

    it('a platform without a build (or a build without a platform) is treated as an old build', async () => {
      await expect(loginAs({ 'x-app-platform': 'desktop' })).resolves.toEqual(
        LEGACY_LOGIN_RESPONSE,
      );
      await expect(loginAs({ 'x-app-build': '10' })).resolves.toEqual(LEGACY_LOGIN_RESPONSE);
      await expect(loginAs({ 'x-app-platform': 'desktop', 'x-app-build': 'abc' })).resolves.toEqual(
        LEGACY_LOGIN_RESPONSE,
      );
      expect(installations.recordLogin).not.toHaveBeenCalled();
    });

    it('a new build is recorded with the real user / company / branch and gets appUpdate', async () => {
      const response = await loginAs(NEW_BUILD_HEADERS);
      expect(response).toEqual({ ...LEGACY_LOGIN_RESPONSE, appUpdate: UPDATE_NOTICE });
      expect(updates.check).toHaveBeenCalledWith('desktop', 10);
      expect(installations.recordLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          companyId: TEST_COMPANY_ID,
          // no device matched, so the user's own branch
          branchId: TEST_BRANCH_ID,
          // Rev 2: the audit columns record the user id
          actor: TEST_USER_ID,
          ip: '127.0.0.1',
          client: expect.objectContaining({ platform: 'desktop', build: 10, deviceId: 'pc-1' }),
        }),
      );
    });

    it('a failed installation write never fails the login, and is logged', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      installations.recordLogin.mockRejectedValue(new Error('relation does not exist'));
      await expect(loginAs(NEW_BUILD_HEADERS)).resolves.toEqual({
        ...LEGACY_LOGIN_RESPONSE,
        appUpdate: UPDATE_NOTICE,
      });
      expect(warn).toHaveBeenCalledWith(
        'App version: could not record the login installation (the request goes on): ' +
          'relation does not exist',
      );
      warn.mockRestore();
    });

    it('a failed update check never fails the login; the response just has no appUpdate', async () => {
      updates.check.mockRejectedValue(new Error('connection terminated'));
      installations.recordLogin.mockImplementation(() => {
        throw new TypeError('synchronous failure');
      });
      await expect(loginAs(NEW_BUILD_HEADERS)).resolves.toEqual(LEGACY_LOGIN_RESPONSE);
    });

    it('counts the legacy body field app_version, without changing the response', async () => {
      await expect(loginAs({}, '1.0.0')).resolves.toEqual(LEGACY_LOGIN_RESPONSE);
      expect(legacyUsage.record).toHaveBeenCalledWith(
        'auth.login.app_version',
        expect.objectContaining({ platform: null, build: null }),
      );
    });

    describe('refresh', () => {
      beforeEach(() => {
        (tokenService as unknown as { verifyRefreshToken: jest.Mock }).verifyRefreshToken = jest
          .fn()
          .mockReturnValue({
            sub: TEST_USER_ID,
            user_name: 'john.doe',
            sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
            branch_id: TEST_BRANCH_ID,
            device_id: null,
            typ: 'refresh',
          });
        (
          authSessionService as unknown as { assertRefreshTokenIsActive: jest.Mock }
        ).assertRefreshTokenIsActive = jest.fn().mockResolvedValue(undefined);
        prismaService.userMaster.findFirst.mockResolvedValue(
          makeUser({ usrLoginName: 'john.doe' }),
        );
      });

      it('an old build is not recorded and the response has no appUpdate', async () => {
        const response = await service.refresh('signed-refresh-token', parseClientInfo({}));
        expect(Object.keys(response)).not.toContain('appUpdate');
        expect(installations.recordRefresh).not.toHaveBeenCalled();
      });

      it('a new build is recorded on refresh, and a failure there never fails the refresh', async () => {
        installations.recordRefresh.mockRejectedValue(new Error('deadlock detected'));
        const response = await service.refresh(
          'signed-refresh-token',
          parseClientInfo(NEW_BUILD_HEADERS),
        );
        expect(response.access_token).toBe('signed-jwt-token');
        expect(Object.keys(response)).not.toContain('appUpdate');
        expect(installations.recordRefresh).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: TEST_USER_ID,
            companyId: TEST_COMPANY_ID,
            branchId: TEST_BRANCH_ID,
            // Rev 2: the audit columns record the user id
            actor: TEST_USER_ID,
          }),
        );
      });
    });
  });
  describe('Part B Step 2 Rev 2: build match + token epoch', () => {
    const DESKTOP_12: BuildPolicy = {
      platform: 'desktop',
      enforce: true,
      expectedBuild: 12,
      message: null,
      downloadUrl: 'https://downloads.example.com/nexerp-12.exe',
      source: 'manifest',
      changedOn: null,
      changedBy: null,
    };
    const enforce = async (...policies: BuildPolicy[]) => {
      stateStore.readPolicies.mockResolvedValue(policies);
      await buildPolicy.reload();
    };
    const attempt = async (
      headers: Record<string, string>,
      {
        password = 'StrongPassword123!',
        deviceType,
      }: { password?: string; deviceType?: string } = {},
    ) => {
      const hashedPassword = await hashPasswordForTest('StrongPassword123!');
      prismaService.userMaster.findFirst.mockResolvedValue(
        makeUser({ usrLoginName: 'john.doe', usrPasswordHash: hashedPassword }),
      );
      return service.login(
        {
          usrLoginName: 'john.doe',
          usrPassword: password,
          ...(deviceType !== undefined && { device_type: deviceType }),
        },
        { userAgent: null, appVersion: null, client: parseClientInfo(headers) },
      );
    };
    const refusal = async (promise: Promise<unknown>): Promise<HttpException> => {
      const error = await promise.then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(HttpException);
      return error as HttpException;
    };
    const desktop = (build?: string) => ({
      'x-app-platform': 'desktop',
      ...(build !== undefined && { 'x-app-build': build }),
    });

    it('enforce = false: any build, or none, logs in as before (tests 1, 2)', async () => {
      await enforce({ ...DESKTOP_12, enforce: false });
      await expect(attempt({})).resolves.toMatchObject({ access_token: 'signed-jwt-token' });
      await expect(attempt(desktop('3'))).resolves.toMatchObject({
        access_token: 'signed-jwt-token',
      });
    });

    it('enforced desktop 12: build 12 logs in (test 3)', async () => {
      await enforce(DESKTOP_12);
      await expect(attempt(desktop('12'))).resolves.toMatchObject({
        access_token: 'signed-jwt-token',
      });
    });

    it('enforced desktop 12: build 10 gets 426 UPDATE_REQUIRED with the spec body (test 4)', async () => {
      await enforce(DESKTOP_12);
      const error = await refusal(attempt(desktop('10')));
      expect(error.getStatus()).toBe(426);
      expect(error.getResponse()).toEqual({
        success: false,
        statusCode: 426,
        code: 'UPDATE_REQUIRED',
        platform: 'desktop',
        clientBuild: 10,
        expectedBuild: 12,
        message: 'Please update VK Nex Desktop to continue.',
        downloadUrl: 'https://downloads.example.com/nexerp-12.exe',
        errors: [
          {
            field: 'x-app-build',
            code: 'UPDATE_REQUIRED',
            message: 'Please update VK Nex Desktop to continue.',
          },
        ],
      });
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    });

    it('a newer build is refused too: exact match (test 5)', async () => {
      await enforce(DESKTOP_12);
      const error = await refusal(attempt(desktop('13')));
      expect(error.getResponse()).toMatchObject({ clientBuild: 13, expectedBuild: 12 });
    });

    it("today's Qt app (no X-App-* header, device_type PC) is refused with clientBuild null (test 6)", async () => {
      await enforce(DESKTOP_12);
      const error = await refusal(attempt({}, { deviceType: 'PC' }));
      expect(error.getStatus()).toBe(426);
      expect(error.getResponse()).toMatchObject({ platform: 'desktop', clientBuild: null });
      // a platform header with a junk build is the same mismatch
      const junk = await refusal(attempt(desktop('abc')));
      expect(junk.getResponse()).toMatchObject({ clientBuild: null });
    });

    it('wrong build + wrong password answers 426 before any user lookup (test 7)', async () => {
      await enforce(DESKTOP_12);
      const error = await refusal(attempt(desktop('10'), { password: 'wrong' }));
      expect(error.getStatus()).toBe(426);
      expect(prismaService.userMaster.findFirst).not.toHaveBeenCalled();
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    });

    it('right build + wrong password keeps the normal login error (test 8)', async () => {
      await enforce(DESKTOP_12);
      const error = await refusal(attempt(desktop('12'), { password: 'wrong' }));
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getResponse()).toMatchObject({
        errors: [expect.objectContaining({ code: 'AUTH_INVALID_CREDENTIALS' })],
      });
    });

    it('platforms are independent: desktop enforced, web logs in on any build (test 9)', async () => {
      await enforce(DESKTOP_12);
      await expect(attempt({ 'x-app-platform': 'web', 'x-app-build': '1' })).resolves.toMatchObject(
        { access_token: 'signed-jwt-token' },
      );
      // the web client's device_type also resolves to web, not desktop
      await expect(attempt({}, { deviceType: 'web' })).resolves.toMatchObject({
        access_token: 'signed-jwt-token',
      });
    });

    it('a custom policy message is what the user reads', async () => {
      await enforce({ ...DESKTOP_12, message: 'Run the updater on this PC' });
      const error = await refusal(attempt(desktop('10')));
      expect(error.getResponse()).toMatchObject({ message: 'Run the updater on this PC' });
    });

    it('stamps the current epoch and the resolved platform into both tokens', async () => {
      stateStore.readEpoch.mockResolvedValue(4);
      await authEpoch.reload();
      await attempt({}, { deviceType: 'Desktop' });
      expect(tokenService.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ ep: 4, platform: 'desktop' }),
      );
      expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ ep: 4, platform: 'desktop' }),
      );
    });

    describe('refresh', () => {
      const refreshPayload = (overrides: Record<string, unknown> = {}) => ({
        sub: TEST_USER_ID,
        user_name: 'john.doe',
        sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
        branch_id: TEST_BRANCH_ID,
        device_id: null,
        typ: 'refresh',
        ep: 2,
        platform: 'desktop',
        ...overrides,
      });
      let assertActive: jest.Mock;
      beforeEach(async () => {
        assertActive = jest.fn().mockResolvedValue(undefined);
        (
          authSessionService as unknown as { assertRefreshTokenIsActive: jest.Mock }
        ).assertRefreshTokenIsActive = assertActive;
        prismaService.userMaster.findFirst.mockResolvedValue(
          makeUser({ usrLoginName: 'john.doe' }),
        );
        stateStore.readEpoch.mockResolvedValue(2);
        await authEpoch.reload();
      });
      const refreshWith = (
        payload: Record<string, unknown>,
        headers: Record<string, string> = {},
      ) => {
        (tokenService as unknown as { verifyRefreshToken: jest.Mock }).verifyRefreshToken = jest
          .fn()
          .mockReturnValue(payload);
        return service.refresh('signed-refresh-token', parseClientInfo(headers));
      };

      it('a refresh token from before the last update is 401 AUTH_BACKEND_UPDATED (test 13)', async () => {
        const error = await refusal(refreshWith(refreshPayload({ ep: 1 })));
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.getResponse()).toMatchObject({
          errors: [{ field: 'refresh_token', code: 'AUTH_BACKEND_UPDATED' }],
        });
        expect(assertActive).not.toHaveBeenCalled();
      });

      it('carries the epoch and platform into the new access token', async () => {
        await expect(refreshWith(refreshPayload())).resolves.toMatchObject({
          access_token: 'signed-jwt-token',
        });
        expect(tokenService.signAccessToken).toHaveBeenCalledWith(
          expect.objectContaining({ ep: 2, platform: 'desktop' }),
        );
      });

      it('meets the build check: header first, else the platform the session logged in on', async () => {
        await enforce(DESKTOP_12);
        // no header: the token says desktop, so a header-less client is refused
        const noHeader = await refusal(refreshWith(refreshPayload()));
        expect(noHeader.getStatus()).toBe(426);
        await expect(refreshWith(refreshPayload(), desktop('12'))).resolves.toMatchObject({
          access_token: 'signed-jwt-token',
        });
        const stale = await refusal(refreshWith(refreshPayload(), desktop('11')));
        expect(stale.getResponse()).toMatchObject({ clientBuild: 11, expectedBuild: 12 });
      });

      it('the emergency switch (enforce false) lets the old build refresh again at once (test 11)', async () => {
        await enforce(DESKTOP_12);
        await expect(refreshWith(refreshPayload(), desktop('10'))).rejects.toBeInstanceOf(
          HttpException,
        );
        await enforce({ ...DESKTOP_12, enforce: false });
        await expect(refreshWith(refreshPayload(), desktop('10'))).resolves.toMatchObject({
          access_token: 'signed-jwt-token',
        });
      });
    });
  });
});
