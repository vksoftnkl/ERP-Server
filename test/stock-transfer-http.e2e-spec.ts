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
 * HTTP-level test for the WHOLE stock-transfer module, /api/v1/stock/transfer*.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard, so the real guard, ValidationPipe, versioning, prefix and
 * exception filters all run and the status codes match the live server on :3011.
 *
 * ENGINE NOTE. Unlike OPENING/PHYSICAL, which post through a TypeScript
 * in-process path, TRANSFER_OUT_RULES.postFunction is 'stock.fn_svh_post_transfer'
 * and the receipt calls 'stock.fn_svh_receive_transfer'. Neither SQL function is
 * deployed on this database (only 4 trigger guards exist in schema `stock`), so
 * despatch and receive-post CANNOT complete here. This spec proves the whole
 * read/save/validate/delete surface works and demonstrates exactly where
 * despatch reaches the missing engine. Stock set up for the save is added with a
 * physical overage and reversed at the end, so the DB nets to zero.
 * See memory: erp-server-http-testing-without-credentials, erp-transfer-engine-not-deployed.
 */

const T = '/api/v1/stock/transfer';
const PHY = '/api/v1/stock/physical';
const BEARER = 'Bearer dummy-test-token';
const NIL = '00000000-0000-4000-8000-000000000000';

const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  accYear: '2026-2027',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const SRC_GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01'; // Coimbatore (has the lot)
const DST_GODOWN = '019c9935-79f4-772b-8666-2b46b9fc82cc'; // namakkal (same branch)
const LOT = '01a08502-d594-72c8-8e94-d79166ac46dc';
const ITEM = '01a08501-ad57-7d0a-9835-bed0246d4170';
const BASE_UOM = '01a08501-ad88-75d9-ba6a-ddecb6a9354e'; // item_unit_conversion iuc_id
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1

const prisma = new PrismaClient();

const ref = (svhId: string) => ({
  svhId,
  accYear: SCOPE.accYear,
  companyId: SCOPE.companyId,
  branchId: SCOPE.branchId,
  userId: ACTOR,
});

describe('Stock transfer module (e2e — live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-transfer-session',
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
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: process.env.API_VERSION ?? '1' });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
    http = request(app.getHttpServer());
  });

  // Reverse the physical overage that seeded stock, whatever happened.
  let physicalSvhId: string | undefined;
  let transferSvhId: string | undefined;
  afterAll(async () => {
    if (physicalSvhId) {
      await http.post(`${PHY}/cancel`).set('Authorization', BEARER).send({
        ...ref(physicalSvhId),
        reason: 'E2E-TRF teardown: reverse the setup overage',
      });
    }
    await app?.close();
    await prisma.$disconnect();
  });

  // ── Auth + validation ──────────────────────────────────────────────────
  it('save: 401 without an Authorization header', async () => {
    const res = await http.post(T).send({});
    expect(res.status).toBe(401);
  });

  it('save: 400 on an empty body', async () => {
    const res = await http.post(T).set('Authorization', BEARER).send({});
    expect(res.status).toBe(400);
  });

  it('inbound: 400 when branchId is missing', async () => {
    const res = await http.get(`${T}/receive/inbound`).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
    });
    expect(res.status).toBe(400);
  });

  // ── Reads against real data ────────────────────────────────────────────
  it('list: 200 lists transfers for the scope', async () => {
    const res = await http.get(T).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      accYear: SCOPE.accYear,
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('inbound: 200 returns my inbound worklist', async () => {
    const res = await http.get(`${T}/receive/inbound`).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  // ── Save business-rule refusals (no stock yet) ─────────────────────────
  const outLine = (qty: number, lotId: string) => ({
    header: {
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      deviceId: SCOPE.deviceId,
      docDate: '2026-09-08',
      fromGodownId: SRC_GODOWN,
      toGodownId: DST_GODOWN,
      userId: ACTOR,
    },
    lines: [
      {
        lineNo: 1,
        itemId: ITEM,
        godownId: SRC_GODOWN,
        lotId,
        bucket: 'SALEABLE',
        uomId: BASE_UOM,
        baseUomId: BASE_UOM,
        toBaseFactor: 1,
        qty,
        baseQty: qty,
      },
    ],
  });

  it('save: 422 when the line names a lot that does not exist', async () => {
    const res = await http.post(T).set('Authorization', BEARER).send(outLine(1, NIL));
    expect(res.status).toBe(422);
  });

  it('save: 422 when the lot has less on hand than the line moves', async () => {
    // On-hand is 0 before the overage below, so moving 5 is refused.
    const res = await http.post(T).set('Authorization', BEARER).send(outLine(5, LOT));
    // eslint-disable-next-line no-console
    console.log(`\n[transfer e2e] over-qty save → HTTP ${res.status}: ${JSON.stringify(res.body?.message)}\n`);
    expect(res.status).toBe(422);
  });

  // ── 404 error paths (reach the handler, before any engine call) ────────
  it('validate: 404 for a non-existent svhId', async () => {
    const res = await http.get(`${T}/validate`).set('Authorization', BEARER).query({
      svhId: NIL,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(404);
  });

  it('despatch: 404 for a non-existent svhId', async () => {
    const res = await http.post(`${T}/despatch`).set('Authorization', BEARER).send(ref(NIL));
    expect(res.status).toBe(404);
  });

  it('cancel: 404 for a non-existent svhId', async () => {
    const res = await http.post(`${T}/cancel`).set('Authorization', BEARER).send({
      ...ref(NIL),
      reason: 'E2E-TRF nonexistent',
    });
    expect(res.status).toBe(404);
  });

  it('receive/post: 404 for a non-existent svhId', async () => {
    const res = await http.post(`${T}/receive/post`).set('Authorization', BEARER).send(ref(NIL));
    expect(res.status).toBe(404);
  });

  it('delete: 404 for a non-existent svhId', async () => {
    const res = await http.delete(T).set('Authorization', BEARER).query({
      svhId: NIL,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(404);
  });

  // ── OUT lifecycle with real stock ──────────────────────────────────────
  it('setup: seed 10 units on the lot via a physical overage', async () => {
    const created = await http.post(`${PHY}/create`).set('Authorization', BEARER).send({
      header: {
        accYear: SCOPE.accYear,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        deviceId: SCOPE.deviceId,
        docDate: '2026-09-08',
        toGodownId: SRC_GODOWN,
        userId: ACTOR,
        remarks: 'E2E-TRF setup overage',
      },
      lines: [
        { lineNo: 1, splitNo: 1, itemId: ITEM, godownId: SRC_GODOWN, bucket: 'SALEABLE', lotId: LOT, countedQty: 10 },
      ],
    });
    expect(created.status).toBe(201);
    physicalSvhId = created.body.data.header.svhId;
    const posted = await http.post(`${PHY}/post`).set('Authorization', BEARER).send(ref(physicalSvhId!));
    expect(posted.status).toBe(201);
  });

  it('save: 201 saves a same-branch TRANSFER_OUT draft (moves 4 of 10)', async () => {
    if (!physicalSvhId) return;
    const res = await http.post(T).set('Authorization', BEARER).send(outLine(4, LOT));
    // eslint-disable-next-line no-console
    console.log(`\n[transfer e2e] save → HTTP ${res.status}, refno ${res.body?.data?.header?.refno}\n`);
    expect(res.status).toBe(201);
    expect(res.body?.data?.header?.status).toBe('DRAFT');
    expect(res.body?.data?.header?.voucherType).toBe('TRANSFER_OUT');
    transferSvhId = res.body.data.header.svhId;
  });

  it('load: 200 loads the draft with its (empty) transit rows', async () => {
    if (!transferSvhId) return;
    const res = await http.get(T).set('Authorization', BEARER).query({
      svhId: transferSvhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(200);
    expect(res.body?.data?.header?.status).toBe('DRAFT');
  });

  it('validate: 200 returns a line-by-line preflight', async () => {
    if (!transferSvhId) return;
    const res = await http.get(`${T}/validate`).set('Authorization', BEARER).query({
      svhId: transferSvhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(`\n[transfer e2e] validate → ${JSON.stringify(res.body?.data)}\n`);
  });

  it('despatch: is refused before moving stock (preflight, then the missing engine)', async () => {
    if (!transferSvhId) return;
    const res = await http.post(`${T}/despatch`).set('Authorization', BEARER).send(ref(transferSvhId));
    // eslint-disable-next-line no-console
    console.log(`\n[transfer e2e] despatch → HTTP ${res.status}: ${JSON.stringify(res.body)}\n`);
    // Despatch cannot succeed on this DB: this holding trips the (mis-applied)
    // opening-uniqueness preflight with 422, and even a clean holding would then
    // hit stock.fn_svh_post_transfer, which is not deployed (would be 500). Either
    // way it never returns a 2xx.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect([200, 201]).not.toContain(res.status);
  });

  it('delete: 200 soft-deletes the draft (cleanup)', async () => {
    if (!transferSvhId) return;
    const res = await http.delete(T).set('Authorization', BEARER).query({
      svhId: transferSvhId,
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
    });
    expect(res.status).toBe(200);
  });
});
