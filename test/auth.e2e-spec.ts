import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UserMaster } from '@prisma/client';
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import * as request from 'supertest';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AppModule } from '../src/app.module';
const scryptAsync = promisify(nodeScrypt);
const USER_ID = 'c31c31ce-b8d3-45f7-a9b6-b9232e56dc48';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const LOGIN_NAME = 'john.doe';
const DISPLAY_NAME = 'John Doe';
const PASSWORD = 'StrongPassword123!';
type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  usrId: string;
  user_name: string;
  user_type: string | null;
  device_id: string | null;
};
// AuthService reaches user_master two ways: by login name on login, by usrId on
// refresh. The mock answers both from the same record.
type UserFindFirstArgs = {
  where: {
    usrLoginName?: { equals: string; mode: string };
    usrId?: string;
  };
};
type PrismaMock = {
  userMaster: {
    findFirst: jest.Mock<Promise<UserMaster | null>, [UserFindFirstArgs]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  userLoginSession: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  $queryRawUnsafe: jest.Mock<Promise<unknown>, [string]>;
};
// expect.objectContaining() is typed `any`; wrapping it keeps the assertions
// below out of no-unsafe-assignment's way.
const containing = (value: Record<string, unknown>): unknown => expect.objectContaining(value);
// Mirrors AuthService.verifyPassword: scrypt$<salt>$<hex>, key length taken from
// the stored hash.
const hashPasswordForTest = async (plainPassword: string): Promise<string> => {
  const salt = 'e2e-test-salt';
  const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
};
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaMock;
  let userRecord: UserMaster;
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-change-me';
    // Keeps the run hermetic: with the cache off, storeTokenSession and
    // assertRefreshTokenIsActive short-circuit instead of needing a live Redis.
    process.env.REDIS_ENABLED = 'false';
    userRecord = {
      usrId: USER_ID,
      usrCompanyId: COMPANY_ID,
      usrBranchId: BRANCH_ID,
      usrLoginName: LOGIN_NAME,
      usrDisplayName: DISPLAY_NAME,
      usrPasswordHash: await hashPasswordForTest(PASSWORD),
      usrType: 'USER',
      usrIsActive: true,
      usrIsLocked: false,
      usrIsDeleted: false,
      usrWebLogin: true,
    } as unknown as UserMaster;
    prismaMock = {
      userMaster: {
        findFirst: jest.fn<Promise<UserMaster | null>, [UserFindFirstArgs]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      userLoginSession: {
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $queryRawUnsafe: jest.fn<Promise<unknown>, [string]>(),
    };
    prismaMock.userMaster.findFirst.mockImplementation(({ where }) => {
      // The service asks for a case-insensitive match, which the mock honours.
      const matchesLoginName =
        where.usrLoginName?.equals.toLowerCase() === userRecord.usrLoginName.toLowerCase();
      const matchesId = where.usrId === userRecord.usrId;
      return Promise.resolve(matchesLoginName || matchesId ? userRecord : null);
    });
    prismaMock.userMaster.update.mockResolvedValue(userRecord);
    prismaMock.userLoginSession.create.mockResolvedValue({
      ulsId: 'login-session-id',
    });
    prismaMock.$queryRawUnsafe.mockResolvedValue([{ ok: true }]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    const configService = app.get(ConfigService);
    const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
    app.setGlobalPrefix(apiPrefix.replace(/^\/+|\/+$/g, ''));
    await app.init();
  });
  afterEach(() => {
    prismaMock.userMaster.findFirst.mockClear();
    prismaMock.userMaster.update.mockClear();
    prismaMock.userLoginSession.create.mockClear();
  });
  afterAll(async () => {
    await app.close();
  });
  const login = (password: string = PASSWORD) => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    return request(httpServer).post('/api/v1/auth/login').send({
      usrLoginName: LOGIN_NAME,
      usrPassword: password,
    });
  };
  it('/api/v1/auth/login (POST) returns tokens and the user identity for valid credentials', async () => {
    const response = await login();
    const responseBody = response.body as LoginResponse;
    expect(response.statusCode).toBe(200);
    expect(responseBody.token_type).toBe('Bearer');
    expect(responseBody.access_token).toEqual(expect.any(String));
    expect(responseBody.refresh_token).toEqual(expect.any(String));
    expect(responseBody.usrId).toBe(USER_ID);
    // user_name carries the display name, not the login name.
    expect(responseBody.user_name).toBe(DISPLAY_NAME);
    expect(responseBody.user_type).toBe('USER');
    // No device_id and no device_type on the payload, so no device is resolved.
    expect(responseBody.device_id).toBeNull();
    // Only an active, unlocked, web-enabled user may log in.
    expect(prismaMock.userMaster.findFirst).toHaveBeenCalledWith({
      where: {
        usrLoginName: { equals: LOGIN_NAME, mode: 'insensitive' },
        usrIsDeleted: false,
        usrIsActive: true,
        usrIsLocked: false,
        usrWebLogin: true,
      },
    });
    expect(prismaMock.userLoginSession.create).toHaveBeenCalledWith({
      data: containing({
        ulsCompanyId: COMPANY_ID,
        ulsBranchId: BRANCH_ID,
        ulsUserId: USER_ID,
        ulsLoginStatus: 'SUCCESS',
        ulsIsActiveSession: true,
      }),
    });
    // A successful login stamps the user and clears the failed-attempt counter.
    expect(prismaMock.userMaster.update).toHaveBeenCalledWith({
      where: { usrId: USER_ID },
      data: containing({ usrFailedLoginCount: 0 }),
    });
  });
  it('/api/v1/auth/refresh (POST) returns a fresh access token for a valid refresh token', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const loginResponseBody = (await login()).body as LoginResponse;
    const refreshResponse = await request(httpServer).post('/api/v1/auth/refresh').send({
      refresh_token: loginResponseBody.refresh_token,
    });
    const refreshResponseBody = refreshResponse.body as LoginResponse;
    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponseBody.token_type).toBe('Bearer');
    expect(refreshResponseBody.access_token).toEqual(expect.any(String));
    // The refresh token is reused; only the access token is re-issued.
    expect(refreshResponseBody.refresh_token).toBe(loginResponseBody.refresh_token);
    expect(refreshResponseBody.usrId).toBe(USER_ID);
    // Re-read by id, so a lockout or deactivation takes effect on the next refresh.
    expect(prismaMock.userMaster.findFirst).toHaveBeenCalledWith(
      containing({ where: containing({ usrId: USER_ID }) }),
    );
  });
  it('/api/v1/auth/login (POST) returns 401 and counts the attempt for an invalid password', async () => {
    const response = await login('WrongPassword123!');
    expect(response.statusCode).toBe(401);
    expect(prismaMock.userLoginSession.create).not.toHaveBeenCalled();
    expect(prismaMock.userMaster.update).toHaveBeenCalledWith({
      where: { usrId: USER_ID },
      data: containing({ usrFailedLoginCount: { increment: 1 } }),
    });
  });
  it('/api/v1/auth/login (POST) returns 401 for an unknown user', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer).post('/api/v1/auth/login').send({
      usrLoginName: 'nobody',
      usrPassword: PASSWORD,
    });
    expect(response.statusCode).toBe(401);
    expect(prismaMock.userMaster.update).not.toHaveBeenCalled();
  });
});
