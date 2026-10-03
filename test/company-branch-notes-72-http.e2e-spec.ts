import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { GstHttpClient } from '../src/modules/gst/client/gst-http.client';
import { GstinLookupService } from '../src/modules/settings/gstinLookup/gstin-lookup.service';

/**
 * NOTES 72 over HTTP: the new routes are mounted, their query / body
 * validation runs through the real pipe and filters, and the guards answer
 * with the right status. Every call is a refusal or a read — nothing here
 * writes — and the GST provider is never called: GstHttpClient is stubbed, and
 * so are the rows GSTIN search would otherwise read and its gst_api_log row.
 * The behaviour itself is covered by company-branch-notes-72.e2e-spec.ts.
 *
 *     npm run test:e2e -- company-branch-notes-72-http
 */

const BEARER = 'Bearer dummy-test-token';
const prisma = new PrismaClient();
const UNKNOWN_ID = '019f0000-0000-7000-8000-000000000072';

describe('Company + Branch masters, notes 72 (HTTP — read-only)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let liveCompanyId: string;
  let defaultCompanyId: string | undefined;
  const env = { ...process.env };

  beforeAll(async () => {
    const [live] = await prisma.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys WHERE NOT comp_is_deleted ORDER BY comp_name LIMIT 1`;
    liveCompanyId = live.comp_id;
    const [def] = await prisma.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys WHERE comp_default AND NOT comp_is_deleted LIMIT 1`;
    defaultCompanyId = def?.comp_id;
    const [user] = await prisma.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE NOT usr_is_deleted LIMIT 1`;

    const claims: AccessTokenPayload = {
      sub: user.usr_id,
      user_name: 'e2e-notes-72',
      sid: 'e2e-notes-72-session',
      user_type: 'SUPER ADMIN',
      company_id: liveCompanyId,
      branch_id: null,
      device_id: null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (_t: string): AccessTokenPayload => claims })
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
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    process.env = { ...env };
    await app?.close();
    await prisma.$disconnect();
  });

  it('restore routes are mounted: 404 for an unknown id, 409 for a live company', async () => {
    const company = await http
      .post('/api/v1/company-masters/restore')
      .set('Authorization', BEARER)
      .query({ compId: UNKNOWN_ID });
    expect(company.status).toBe(404);
    const branch = await http
      .post('/api/v1/branch-masters/restore')
      .set('Authorization', BEARER)
      .query({ brId: UNKNOWN_ID });
    expect(branch.status).toBe(404);
    const live = await http
      .post('/api/v1/company-masters/restore')
      .set('Authorization', BEARER)
      .query({ compId: liveCompanyId });
    expect(live.status).toBe(409);
    expect(live.body.errors[0].field).toBe('compId');
  });

  it('the default company is refused with 409, not deleted', async () => {
    if (!defaultCompanyId) return;
    const res = await http
      .delete('/api/v1/company-masters/delete')
      .set('Authorization', BEARER)
      .query({ compId: defaultCompanyId });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('The default company cannot be deleted');
  });

  it('create refuses an unknown GST type, AATO class or DC purpose before touching the table', async () => {
    const res = await http
      .post('/api/v1/company-masters/create')
      .set('Authorization', BEARER)
      .send({
        compName: 'ZT72-HTTP-never-saved',
        compStateCode: '33',
        compGstRegType: 'Consumer',
        compAatoClass: 'HUGE',
        compDcPurposes: ['SUPPLY', 'SMUGGLING'],
      });
    expect(res.status).toBe(400);
    const fields = (res.body.errors as Array<{ field: string }>).map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(['compGstRegType', 'compAatoClass', 'compDcPurposes']),
    );
  });

  it('GET /gst/search validates the GSTIN and answers from the provider (rows and network stubbed)', async () => {
    const bad = await http
      .get('/api/v1/gst/search')
      .set('Authorization', BEARER)
      .query({ gstin: 'ABC' });
    expect(bad.status).toBe(400);

    // Notes 87: search runs on the GST Provider rows. Stub the route those rows
    // would give, the company it searches as and the log write, so this stays
    // read-only and independent of what the box has switched on.
    const route = {
      provider: { gpvId: 'gpv-e2e', gpvCode: 'E2E', gpvTimeoutMs: 30000 },
      service: {
        gpsGpvId: 'gpv-e2e',
        gpsEnvironment: 'SANDBOX',
        gpsBaseUrl: 'https://gsp.example',
        gpsTimeoutMs: null,
      },
      endpoint: {
        gpeHttpMethod: 'GET',
        gpePathTemplate: '/commonapi/v1.1/search',
        gpeQueryTemplate: '?Action=TP&Gstin={gstin}&SearchGstin={searchGstin}',
        gpeHeaders: null,
        gpeTimeoutMs: 10000,
        gpeSuccessPath: null,
        gpeResponseRootPath: null,
      },
      account: { gpaClientIdEnc: null, gpaClientSecretEnc: null, gpaApiKeyEnc: null },
    };
    const lookup = GstinLookupService.prototype as unknown as Record<
      'resolveRoute' | 'resolveSource' | 'log',
      () => Promise<unknown>
    >;
    const spies = [
      jest.spyOn(lookup, 'resolveRoute').mockResolvedValue(route),
      jest
        .spyOn(lookup, 'resolveSource')
        .mockResolvedValue({ companyId: liveCompanyId, sourceGstin: '33AAAAA0000A1Z5' }),
      jest.spyOn(lookup, 'log').mockResolvedValue(undefined),
    ];
    const send = jest.spyOn(GstHttpClient.prototype, 'send').mockResolvedValue({
      status: 200,
      text: JSON.stringify({
        data: { lgnm: 'ZT LEGAL NAME', tradeNam: 'ZT TRADE', dty: 'Composition' },
      }),
    });
    try {
      const res = await http
        .get('/api/v1/gst/search')
        .set('Authorization', BEARER)
        .query({ gstin: '33abnpl5414f1zu' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        gstin: '33ABNPL5414F1ZU',
        legalName: 'ZT LEGAL NAME',
        gstRegType: 'COMPOSITION',
        panNo: 'ABNPL5414F',
      });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0].url).toBe(
        'https://gsp.example/commonapi/v1.1/search?Action=TP&Gstin=33AAAAA0000A1Z5&SearchGstin=33ABNPL5414F1ZU',
      );
    } finally {
      send.mockRestore();
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
