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
type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type PrismaMock = {
  user: {
    findUnique: jest.Mock<Promise<User | null>, [{ where: { user_name: string } }]>;
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
    process.env.JWT_EXPIRES_IN = '900';

    userRecord = {
      user_id: USER_ID,
      user_name: 'john.doe',
      user_password: await hashPasswordForTest('StrongPassword123!'),
    };

    prismaMock = {
      user: {
        findUnique: jest.fn<Promise<User | null>, [{ where: { user_name: string } }]>(),
      },
      $queryRawUnsafe: jest.fn<Promise<unknown>, [string]>(),
    };
    prismaMock.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.user_name === userRecord.user_name ? userRecord : null),
    );
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/auth/login (POST) returns access token for valid credentials', async () => {
    const httpServer = app.getHttpAdapter().getInstance() as Parameters<typeof request>[0];
    const response = await request(httpServer).post('/api/v1/auth/login').send({
      user_name: 'john.doe',
      user_password: 'StrongPassword123!',
    });
    const responseBody = response.body as LoginResponse;

    expect(response.statusCode).toBe(200);
    expect(responseBody.token_type).toBe('Bearer');
    expect(responseBody.expires_in).toBe(900);
    expect(responseBody.access_token).toEqual(expect.any(String));
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: {
        user_name: 'john.doe',
      },
    });
  });

  it('/api/v1/auth/login (POST) returns 401 for invalid password', async () => {
    const httpServer = app.getHttpAdapter().getInstance() as Parameters<typeof request>[0];
    const response = await request(httpServer).post('/api/v1/auth/login').send({
      user_name: 'john.doe',
      user_password: 'WrongPassword123!',
    });

    expect(response.statusCode).toBe(401);
  });
});
