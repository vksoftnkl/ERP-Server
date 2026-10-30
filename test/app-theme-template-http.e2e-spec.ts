import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';

/**
 * plan-app-theme-template.md §4.1 over HTTP with the REAL auth guard and no
 * token at all: /bootstrap answers (the login window is painted before anyone
 * logs in) with nothing but the default tokens and the template; everything
 * else in /app-themes still needs a token. Read-only.
 *
 *     npm run test:e2e -- app-theme-template-http
 */
describe('App theme template (HTTP — no token)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
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
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('/bootstrap answers without a token: tokens + template, nothing else; 304 on its ETag', async () => {
    const res = await http.get('/api/v1/app-themes/bootstrap');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['template', 'thmModifiedOn', 'tokens']);
    expect(res.body.data.template).toMatchObject({ tplId: expect.any(Number) });
    expect(typeof res.body.data.template.tplQss).toBe('string');
    const again = await http
      .get('/api/v1/app-themes/bootstrap')
      .set('If-None-Match', res.headers.etag as string);
    expect(again.status).toBe(304);
  });

  it('the rest of /app-themes still needs a token', async () => {
    expect((await http.get('/api/v1/app-themes/template')).status).toBe(401);
    expect(
      (await http.post('/api/v1/app-themes/template/save').send({ tplId: 1, tplQss: '' })).status,
    ).toBe(401);
    expect(
      (
        await http
          .get('/api/v1/app-themes/effective')
          .query({ companyId: '00000000-0000-0000-0000-000000000000' })
      ).status,
    ).toBe(401);
  });
});
