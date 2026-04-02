import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import * as request from 'supertest';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AppModule } from '../src/app.module';
const scryptAsync = promisify(nodeScrypt);
const USER_ID = 'c31c31ce-b8d3-45f7-a9b6-b9232e56dc48';
const TEST_TIMESTAMP = new Date('2026-03-20T00:00:00.000Z');
type LoginResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
};
type PrismaMock = {
  user: {
    findUnique: jest.Mock<Promise<User | null>, [{ where: { user_name: string } }]>;
  };
  userLoginSession: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  $queryRawUnsafe: jest.Mock<Promise<unknown>, [string]>;
};
const hashPasswordForTest = async (plainPassword: string): Promise<string> => {
  const salt = 'e2e-test-salt';
  const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
};
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaMock;
  let userRecord: User;
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-change-me';
    userRecord = {
      user_id: USER_ID,
      user_code: 'us1001',
      user_phone: '9999999998',
      user_name: 'john.doe',
      user_password: await hashPasswordForTest('StrongPassword123!'),
      created_at: TEST_TIMESTAMP,
      updated_at: TEST_TIMESTAMP,
    };
    prismaMock = {
      user: {
        findUnique: jest.fn<Promise<User | null>, [{ where: { user_name: string } }]>(),
      },
      userLoginSession: {
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $queryRawUnsafe: jest.fn<Promise<unknown>, [string]>(),
    };
    prismaMock.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.user_name === userRecord.user_name ? userRecord : null),
    );
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
    prismaMock.user.findUnique.mockClear();
    prismaMock.userLoginSession.create.mockClear();
  });
  afterAll(async () => {
    await app.close();
  });
  it('/api/v1/auth/login (POST) returns access token and user id for valid credentials', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer).post('/api/v1/auth/login').send({
      user_name: 'john.doe',
      user_password: 'StrongPassword123!',
    });
    const responseBody = response.body as LoginResponse;
    expect(response.statusCode).toBe(200);
    expect(responseBody.token_type).toBe('Bearer');
    expect(responseBody.access_token).toEqual(expect.any(String));
    expect(responseBody.user_id).toBe(USER_ID);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: {
        user_name: 'john.doe',
      },
    });
    expect(prismaMock.userLoginSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ulsCompanyId: null,
        ulsBranchId: null,
        ulsUserId: USER_ID,
        ulsLoginStatus: 'SUCCESS',
      }),
    });
  });
  it('/api/v1/auth/login (POST) returns 401 for invalid password', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer).post('/api/v1/auth/login').send({
      user_name: 'john.doe',
      user_password: 'WrongPassword123!',
    });
    expect(response.statusCode).toBe(401);
  });
});
