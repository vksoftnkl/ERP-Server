// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * Notes 79 routes over HTTP: the routes exist under /api/v1/gst/…, the DTOs
 * validate (and normalise) as documented, refusals carry the module's error
 * shape. READ-ONLY on the database: every request either fails validation or
 * stops at the menu right (the actor holds none on the two GST menus), so
 * nothing is written. The behaviour behind the rights is gst-config.e2e-spec.
 *
 *     npm run test:e2e -- gst-config-http
 */

const BEARER = 'Bearer dummy-test-token';
const UNKNOWN_ID = '01a0c256-0000-7000-8000-000000000000';
// A real user row with no user_menus rows on GST Providers / GST Credentials.
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

describe('GST config routes (HTTP, read-only)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-test-session',
      user_type: 'SUPER ADMIN',
      company_id: null,
      branch_id: null,
      device_id: null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (): AccessTokenPayload => claims })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .compile();
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
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (route: string, body: object) =>
    request(app.getHttpServer())
      .post(`/api/v1/gst/${route}`)
      .set('Authorization', BEARER)
      .send(body);
  const get = (route: string) =>
    request(app.getHttpServer()).get(`/api/v1/gst/${route}`).set('Authorization', BEARER);
  const fields = (res: request.Response) =>
    (res.body as { errors: Array<{ field: string }> }).errors.map((e) => e.field);

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/gst/providers/create').send({});
    expect(res.status).toBe(401);
  });

  it('400 names each bad provider field, and refuses fields the DTO does not declare', async () => {
    const res = await post('providers/create', {
      gpvCode: '9-bad',
      gpvName: '',
      gpvTimeoutMs: 10,
      gpvAspId: 'x',
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Validation failed' });
    const text = JSON.stringify(res.body);
    for (const name of ['gpvCode', 'gpvName', 'gpvTimeoutMs', 'gpvAspId']) {
      expect(text).toContain(name);
    }
  });

  it('a valid body passes validation (vocabularies upper-cased, trailing / dropped) and stops at the right', async () => {
    const res = await post('provider-services/create', {
      gpsGpvId: UNKNOWN_ID,
      gpsService: 'einvoice',
      gpsEnvironment: 'sandbox',
      gpsBaseUrl: 'https://einv.example.test/',
      gpsAuthScheme: 'nic_sek',
      gpsFallbackUrls: null,
    });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('GST_RIGHT_CREATE');
  });

  it('400 on a bad vocabulary value, a bad JSONPath and a header map that is not an object', async () => {
    const res = await post('provider-endpoints/create', {
      gpeGpsId: UNKNOWN_ID,
      gpeAction: 'LOGIN',
      gpePathTemplate: 'no-slash',
      gpeHeaders: ['Gstin'],
      gpeRedactPaths: ['Data'],
    });
    expect(res.status).toBe(400);
    expect(fields(res).join(' ')).toMatch(/gpeAction.*gpePathTemplate|gpePathTemplate.*gpeAction/s);
    const text = JSON.stringify(res.body);
    expect(text).toContain('gpeHeaders');
    expect(text).toContain('gpeRedactPaths');
  });

  it('400 on a credential with a bad IP, a non-date and password in clear', async () => {
    const res = await post('company-credentials/create', {
      gccCompanyId: UNKNOWN_ID,
      gccGpvId: UNKNOWN_ID,
      gccEnvironment: 'SANDBOX',
      gccLoginId: 'user',
      gccValidFrom: '01/04/2026',
      gccWhitelistedIps: ['300.1.1.1'],
      clear: ['password'],
    });
    expect(res.status).toBe(400);
    const text = JSON.stringify(res.body);
    for (const name of ['gccValidFrom', 'gccWhitelistedIps', 'clear']) {
      expect(text).toContain(name);
    }
  });

  it('every route answers: 400 without its id, 403 GST_RIGHT_<RIGHT> with one', async () => {
    expect((await get('providers/get')).status).toBe(400);
    expect((await post('company-credentials/verify', {})).status).toBe(400);
    const cases: Array<[() => Promise<request.Response>, string]> = [
      [() => get(`providers/get?gpvId=${UNKNOWN_ID}`), 'GST_RIGHT_VIEW'],
      [() => post('providers/delete', { gpvId: UNKNOWN_ID }), 'GST_RIGHT_DELETE'],
      [() => post('providers/restore', { gpvId: UNKNOWN_ID }), 'GST_RIGHT_EDIT'],
      [() => post('provider-services/delete', { gpsId: UNKNOWN_ID }), 'GST_RIGHT_DELETE'],
      [() => get(`provider-endpoints/get?gpeId=${UNKNOWN_ID}`), 'GST_RIGHT_VIEW'],
      [() => post('provider-endpoints/delete', { gpeId: UNKNOWN_ID }), 'GST_RIGHT_DELETE'],
      [() => post('provider-field-maps/delete', { gfmId: UNKNOWN_ID }), 'GST_RIGHT_DELETE'],
      [() => post('provider-error-maps/delete', { gemId: UNKNOWN_ID }), 'GST_RIGHT_DELETE'],
      [() => get(`provider-accounts/get?gpaId=${UNKNOWN_ID}`), 'GST_RIGHT_VIEW'],
      [() => post('provider-accounts/delete', { gpaId: UNKNOWN_ID }), 'GST_RIGHT_DELETE'],
      [() => get(`company-credentials/get?gccId=${UNKNOWN_ID}`), 'GST_RIGHT_VIEW'],
      [() => get(`company-credentials/status?gccId=${UNKNOWN_ID}`), 'GST_RIGHT_VIEW'],
      [() => post('company-credentials/delete', { gccId: UNKNOWN_ID }), 'GST_RIGHT_DELETE'],
      [() => post('company-credentials/restore', { gccId: UNKNOWN_ID }), 'GST_RIGHT_EDIT'],
      [() => post('company-credentials/verify', { gccId: UNKNOWN_ID }), 'GST_RIGHT_POST'],
    ];
    for (const [call, code] of cases) {
      const res = await call();
      expect({ status: res.status, code: JSON.stringify(res.body).includes(code) }).toEqual({
        status: 403,
        code: true,
      });
    }
  });
});
