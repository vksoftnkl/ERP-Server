// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL etc. are
// present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * HTTP-level test for the physical-count screen, /api/v1/stock/physical/*.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard — the real AccessTokenGuard, the global ValidationPipe,
 * URI versioning, the global prefix and the exception filters all run, so the
 * status codes match the live server on :3011. It drives the SAME database.
 *
 * The lifecycle test creates a temporary OVERAGE on a real holding, posts it,
 * then CANCELS it — so the net effect on stock is zero. See memory:
 * erp-server-http-testing-without-credentials.
 */

const BASE = '/api/v1/stock/physical';
const BEARER = 'Bearer dummy-test-token';
const NIL_UUID = '00000000-0000-4000-8000-000000000000';

// The one scope with holdings on this DB (the Coimbatore godown).
const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  accYear: '2026-2027',
  godownId: '019daae6-c65c-7eb8-9ba2-7659611b0a01',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1

const prisma = new PrismaClient();

interface CountRow {
  lineNo: number;
  splitNo: number;
  itemId: string;
  godownId: string;
  bucket: string;
  lotId: string;
  bookQty: number;
}

describe('Physical stock count (e2e — live DB, net-zero lifecycle)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-physical-session',
      user_type: 'SUPER ADMIN',
      company_id: SCOPE.companyId,
      branch_id: SCOPE.branchId,
      device_id: SCOPE.deviceId,
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
    await app?.close();
    await prisma.$disconnect();
  });

  // ── Auth + validation ──────────────────────────────────────────────────
  it('count-sheet: 401 without an Authorization header', async () => {
    const res = await http.get(`${BASE}/count-sheet`).query(SCOPE);
    expect(res.status).toBe(401);
  });

  it('count-sheet: 400 when godownId is missing', async () => {
    const { godownId: _omit, ...noGodown } = SCOPE;
    const res = await http.get(`${BASE}/count-sheet`).set('Authorization', BEARER).query(noGodown);
    expect(res.status).toBe(400);
  });

  // ── Reads against real data ────────────────────────────────────────────
  let sheet: CountRow[] = [];

  it('count-sheet: 200, one line per godown × lot × bucket', async () => {
    const res = await http.get(`${BASE}/count-sheet`).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      accYear: SCOPE.accYear,
      godownId: SCOPE.godownId,
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body?.data?.items)).toBe(true);
    sheet = res.body.data.items as CountRow[];
    // eslint-disable-next-line no-console
    console.log(`\n[physical e2e] count-sheet returned ${sheet.length} holdings\n`);
  });

  it('get: 200 lists physical counts for the scope', async () => {
    const res = await http.get(`${BASE}/get`).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      accYear: SCOPE.accYear,
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  // ── Error paths that need no document ──────────────────────────────────
  it('post: 404 for a non-existent svhId', async () => {
    const res = await http.post(`${BASE}/post`).set('Authorization', BEARER).send({
      svhId: NIL_UUID,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
    });
    expect(res.status).toBe(404);
  });

  it('cancel: 404 for a non-existent svhId', async () => {
    const res = await http.post(`${BASE}/cancel`).set('Authorization', BEARER).send({
      svhId: NIL_UUID,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
      reason: 'E2E-PHY nonexistent id',
    });
    expect(res.status).toBe(404);
  });

  // ── Full lifecycle: create → validate → post → variance → get → cancel ──
  let svhId: string | undefined;
  const VARIANCE = 5; // overage added on line 1, reversed by the final cancel

  it('create: 201 saves a DRAFT count with one overage line', async () => {
    if (sheet.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('  no holdings in this godown — lifecycle skipped');
      return;
    }
    // One line, +VARIANCE over book, taken verbatim from the count sheet.
    const row = sheet[0];
    const res = await http
      .post(`${BASE}/create`)
      .set('Authorization', BEARER)
      .send({
        header: {
          accYear: SCOPE.accYear,
          companyId: SCOPE.companyId,
          branchId: SCOPE.branchId,
          deviceId: SCOPE.deviceId,
          docDate: '2026-09-08',
          toGodownId: SCOPE.godownId,
          userId: ACTOR,
          remarks: 'E2E-PHY net-zero lifecycle',
        },
        lines: [
          {
            lineNo: row.lineNo,
            splitNo: row.splitNo,
            itemId: row.itemId,
            godownId: row.godownId,
            bucket: row.bucket,
            lotId: row.lotId,
            countedQty: Number(row.bookQty) + VARIANCE,
          },
        ],
      });

    const refno = res.body?.data?.header?.refno;
    // eslint-disable-next-line no-console
    console.log(`\n[physical e2e] create HTTP ${res.status} — refno ${refno}\n`);
    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.header?.status).toBe('DRAFT');
    // The whole point of this change: PHY0001, not PHY/2026-2027/<uuid>/1.
    expect(refno).toMatch(/^PHY\d{4}$/);
    svhId = res.body.data.header.svhId;
    expect(svhId).toBeTruthy();
  });

  it('validate: 200 and the line is clean', async () => {
    if (!svhId) return;
    const res = await http.get(`${BASE}/validate`).set('Authorization', BEARER).query({
      svhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    const problems = (res.body?.data as Array<{ problem: unknown }>).filter(
      (r) => r.problem !== null,
    );
    expect(problems.length).toBe(0);
  });

  it('post: 201 posts the variance (rowsPosted >= 1)', async () => {
    if (!svhId) return;
    const res = await http.post(`${BASE}/post`).set('Authorization', BEARER).send({
      svhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
    });
    // eslint-disable-next-line no-console
    console.log(
      `\n[physical e2e] post HTTP ${res.status} — ${JSON.stringify(res.body?.message)}\n`,
    );
    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.rowsPosted).toBeGreaterThanOrEqual(1);
  });

  it('variance: 200 and the varied line is reported', async () => {
    if (!svhId) return;
    const res = await http.get(`${BASE}/variance`).set('Authorization', BEARER).query({
      svhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(200);
    expect(res.body?.data?.items?.length).toBeGreaterThanOrEqual(1);
  });

  it('get: 200 loads the POSTED count by svhId', async () => {
    if (!svhId) return;
    const res = await http.get(`${BASE}/get`).set('Authorization', BEARER).query({
      svhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(200);
    expect(res.body?.data?.header?.status).toBe('POSTED');
  });

  it('cancel: 201 reverses the variance — restores the book figure (net zero)', async () => {
    if (!svhId) return;
    const res = await http.post(`${BASE}/cancel`).set('Authorization', BEARER).send({
      svhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
      reason: 'E2E-PHY reverse the temporary overage',
    });
    // eslint-disable-next-line no-console
    console.log(
      `\n[physical e2e] cancel HTTP ${res.status} — ${JSON.stringify(res.body?.message)}\n`,
    );
    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.status).toBe('CANCELLED');
    expect(res.body?.data?.rowsReversed).toBeGreaterThanOrEqual(1);

    const after = await prisma.$queryRawUnsafe<Array<{ svh_status: string }>>(
      `SELECT svh_status FROM stock.stock_voucher WHERE svh_id = $1::uuid`,
      svhId,
    );
    expect(after[0]?.svh_status).toBe('CANCELLED');
  });
});
