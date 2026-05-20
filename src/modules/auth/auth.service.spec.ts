import { UnauthorizedException } from '@nestjs/common';
import { UserMaster } from '@prisma/client';
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
const scryptAsync = promisify(nodeScrypt);
const TEST_USER_ID = '7a9a4d16-9940-4b65-a7bc-57e83887a112';
const TEST_COMPANY_ID = '73085398-6f07-4dde-9a4c-8264df7077e1';
const TEST_BRANCH_ID = 'a67885f8-0871-498d-af97-d958cdd68113';
const TEST_TIMESTAMP = new Date('2026-03-20T00:00:00.000Z');
type TokenServiceMock = {
  signAccessToken: jest.Mock<
    {
      token: string;
      payload: { sub: string; user_name: string; sid: string; iat: number; exp: number; typ: 'access' };
    },
    [{ sub: string; user_name: string; sid: string }]
  >;
  signRefreshToken: jest.Mock<
    {
      token: string;
      payload: { sub: string; user_name: string; sid: string; iat: number; exp: number; typ: 'refresh' };
    },
    [{ sub: string; user_name: string; sid: string }]
  >;
};
type AuthSessionServiceMock = {
  createSessionId: jest.Mock<string, []>;
  storeAccessTokenSession: jest.Mock<
    Promise<void>,
    [string, { sub: string; user_name: string; sid: string; iat: number; exp: number; typ: 'access' }]
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
      createSessionId: jest.fn<string, []>().mockReturnValue('4e457f70-cc9b-4e8f-b7e4-35cc3f588c22'),
      storeAccessTokenSession: jest
        .fn<
          Promise<void>,
          [string, { sub: string; user_name: string; sid: string; iat: number; exp: number; typ: 'access' }]
        >()
        .mockResolvedValue(undefined),
      storeTokenSession: jest
        .fn<
          Promise<void>,
          [
            string,
            { sub: string; user_name: string; sid: string; iat: number; exp: number; typ: 'access' },
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

    service = new AuthService(
      tokenService as unknown as TokenService,
      authSessionService as unknown as AuthSessionService,
      prismaService as unknown as PrismaService,
      requestContextService as unknown as RequestContextService,
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
    });
    expect(prismaService.userMaster.findFirst).toHaveBeenCalledWith({
      where: {
        usrLoginName: { equals: 'john.doe', mode: 'insensitive' },
        usrIsDeleted: false,
        usrIsActive: true,
        usrIsLocked: false,
        usrWebLogin: true,
      },
    });
    expect(tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: TEST_USER_ID,
      user_name: 'john.doe',
      sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
    });
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith({
      sub: TEST_USER_ID,
      user_name: 'john.doe',
      sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
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
});