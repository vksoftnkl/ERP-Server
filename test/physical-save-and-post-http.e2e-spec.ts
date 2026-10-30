import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  grantMenuRights,
  PHYSICAL_STOCK_MENU,
  restoreMenuRights,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * Notes 94 B / 106 — `/stock/physical/create` with `header.post: true` (or
 * `header.status: 'POSTED'`): save and post in ONE call, the way opening stock
 * and stock adjustment already work. A refused one leaves no document.
 *
 * Live DB, the Coimbatore godown. The posted count is cancelled at the end
 * (net zero on the shelf).
 */

const BASE = '/api/v1/stock/physical';
const BEARER = 'Bearer dummy-test-token';
const NIL_UUID = '00000000-0000-4000-8000-000000000000';
const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  accYear: '2026-2027',
  godownId: '019daae6-c65c-7eb8-9ba2-7659611b0a01',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1
const tag = `E2E-PHY-SP-${Date.now().toString(36)}`;

const prisma = new PrismaClient();
// Notes 150 #6 — every /stock/physical/* route is judged on menu 45; tester1
// holds no row, so the suite grants one for the run and puts it back after.
let menuRights: MenuRightsMemo | null = null;

interface CountRow {
  lineNo: number;
  splitNo: number;
  itemId: string;
  godownId: string;
  bucket: string;
  lotId: string;
  bookQty: number;
}

describe('physical count — save and post in one call (e2e, live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let sheet: CountRow[] = [];
  let svhId: string | undefined;

  const header = (extra: Record<string, unknown>) => ({
    accYear: SCOPE.accYear,
    companyId: SCOPE.companyId,
    branchId: SCOPE.branchId,
    deviceId: SCOPE.deviceId,
    docDate: new Date().toISOString().slice(0, 10),
    toGodownId: SCOPE.godownId,
    userId: ACTOR,
    remarks: tag,
    ...extra,
  });

  beforeAll(async () => {
    menuRights = await grantMenuRights(prisma, [PHYSICAL_STOCK_MENU]);
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-physical-sp',
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

    const res = await http.get(`${BASE}/count-sheet`).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      accYear: SCOPE.accYear,
      godownId: SCOPE.godownId,
    });
    sheet = (res.body?.data?.items ?? []) as CountRow[];
  }, 180_000);

  afterAll(async () => {
    await restoreMenuRights(prisma, menuRights);
    await app?.close();
    await prisma.$disconnect();
  });

  it('header.post: true saves and posts the count in one call', async () => {
    if (sheet.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('  no holdings in this godown — skipped');
      return;
    }
    const row = sheet[0];
    const res = await http
      .post(`${BASE}/create`)
      .set('Authorization', BEARER)
      .send({
        header: header({ post: true }),
        lines: [
          {
            lineNo: row.lineNo,
            splitNo: row.splitNo,
            itemId: row.itemId,
            godownId: row.godownId,
            bucket: row.bucket,
            lotId: row.lotId,
            countedQty: Number(row.bookQty) + 3,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toMatch(/created and posted — \d+ line\(s\) varied$/);
    expect(res.body?.data?.header?.status).toBe('POSTED');
    expect(res.body?.data?.rowsPosted).toBeGreaterThanOrEqual(1);
    svhId = res.body.data.header.svhId;
  });

  it('a refused one-call leaves no document', async () => {
    const res = await http
      .post(`${BASE}/create`)
      .set('Authorization', BEARER)
      .send({
        header: header({ status: 'POSTED', remarks: `${tag}-REFUSED` }),
        lines: [
          {
            lineNo: 1,
            splitNo: 1,
            itemId: NIL_UUID,
            godownId: SCOPE.godownId,
            bucket: 'SALEABLE',
            lotId: NIL_UUID,
            countedQty: 1,
          },
        ],
      });
    expect([404, 422]).toContain(res.status);
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM stock.stock_voucher WHERE svh_remarks = $1`,
      `${tag}-REFUSED`,
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it('cancels the posted count (net zero)', async () => {
    if (!svhId) return;
    const res = await http
      .post(`${BASE}/cancel`)
      .set('Authorization', BEARER)
      .send({
        svhId,
        accYear: SCOPE.accYear,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        userId: ACTOR,
        reason: `${tag} reverse the temporary overage`,
      });
    expect(res.status).toBe(201);
    expect(res.body?.data?.status).toBe('CANCELLED');
  });
});
