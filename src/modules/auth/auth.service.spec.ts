import { Logger, UnauthorizedException } from '@nestjs/common';
import { UserMaster } from '@prisma/client';
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { parseClientInfo } from '../../common/client-info/client-info';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AppUpdateService } from '../app-version/services/app-update.service';
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
    });
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith({
      sub: TEST_USER_ID,
      user_name: 'john.doe',
      sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
      user_type: 'USER',
      company_id: TEST_COMPANY_ID,
      branch_id: null,
      device_id: null,
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
          actor: 'john.doe',
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
            actor: 'john.doe',
          }),
        );
      });
    });
  });
});
