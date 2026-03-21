import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', async () => {
    const httpServer = app.getHttpAdapter().getInstance() as Parameters<typeof request>[0];
    const response = await request(httpServer).get('/api/v1/health');

    expect([200, 503]).toContain(response.statusCode);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('database');
  });
});
