// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * HTTP-level test for POST /api/v1/stock/opening/cancel.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard — the real AccessTokenGuard, the global ValidationPipe,
 * URI versioning, the global prefix and the exception filters all run, so the
 * status codes match the live server on :3011. This drives the SAME database
 * the live server uses, so the happy-path case performs a real cancellation.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const ROUTE = '/api/v1/stock/opening/cancel';
const BEARER = 'Bearer dummy-test-token';
const NIL_BUT_VALID_UUID = '00000000-0000-4000-8000-000000000000';

const prisma = new PrismaClient();

interface Voucher {
  svhId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  refno: string;
}

type VStatus = 'POSTED' | 'DRAFT' | 'CANCELLED';

async function findVoucher(
  where: string,
  ...params: unknown[]
): Promise<(Voucher & { status: VStatus }) | null> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      svh_id: string;
      svh_acc_year: string;
      svh_company_id: string;
      svh_branch_id: string;
      svh_refno: string;
      svh_status: VStatus;
    }>
  >(
    `SELECT svh_id, svh_acc_year, svh_company_id, svh_branch_id, svh_refno, svh_status
       FROM stock.stock_voucher
      WHERE svh_voucher_type = 'OPENING' AND ${where}
      ORDER BY svh_created_on ASC
      LIMIT 1`,
    ...params,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    svhId: row.svh_id,
    accYear: row.svh_acc_year,
    companyId: row.svh_company_id,
    branchId: row.svh_branch_id,
    refno: row.svh_refno,
    status: row.svh_status,
  };
}

describe('POST /stock/opening/cancel (e2e — live DB)', () => {
  let app: INestApplication;
  // The one voucher this suite is allowed to cancel: a clearly manual test
  // document (refno 'opn0000…'). A real posted business voucher is NEVER
  // targeted for cancellation.
  let target: (Voucher & { status: VStatus }) | null;
  let draft: Voucher | null;
  // tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
  const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

  beforeAll(async () => {
    target = await findVoucher(`svh_refno LIKE $1`, 'opn0000%');
    draft = await findVoucher(`svh_status = 'DRAFT'`);

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-test-session',
      user_type: 'SUPER ADMIN',
      company_id: target?.companyId ?? null,
      branch_id: target?.branchId ?? null,
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
    // Mirror src/main.ts so the route, validation and errors behave as live.
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

    // eslint-disable-next-line no-console
    console.log(
      `\n[cancel e2e] cancel target: ${target ? `${target.refno} (${target.svhId}) status=${target.status}` : 'NONE'}` +
        `\n[cancel e2e] draft target : ${draft ? `${draft.refno} (${draft.svhId})` : 'NONE'}\n`,
    );
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('401 when the Authorization header is missing', async () => {
    const res = await request(app.getHttpServer()).post(ROUTE).send({});
    expect(res.status).toBe(401);
  });

  it('400 when the body is empty (required fields fail validation)', async () => {
    const res = await request(app.getHttpServer())
      .post(ROUTE)
      .set('Authorization', BEARER)
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 when reason is missing', async () => {
    if (!target) return;
    const res = await request(app.getHttpServer()).post(ROUTE).set('Authorization', BEARER).send({
      svhId: target.svhId,
      accYear: target.accYear,
      companyId: target.companyId,
      branchId: target.branchId,
      userId: ACTOR,
    });
    expect(res.status).toBe(400);
  });

  it('404 when the voucher does not exist', async () => {
    if (!target) return;
    const res = await request(app.getHttpServer()).post(ROUTE).set('Authorization', BEARER).send({
      svhId: NIL_BUT_VALID_UUID,
      accYear: target.accYear,
      companyId: target.companyId,
      branchId: target.branchId,
      userId: ACTOR,
      reason: 'E2E-CANCEL nonexistent id',
    });
    expect(res.status).toBe(404);
  });

  it('409 when the target is a DRAFT (nothing to reverse)', async () => {
    if (!draft) {
      // eslint-disable-next-line no-console
      console.warn('  no DRAFT opening on this DB — 409 case skipped');
      return;
    }
    const res = await request(app.getHttpServer()).post(ROUTE).set('Authorization', BEARER).send({
      svhId: draft.svhId,
      accYear: draft.accYear,
      companyId: draft.companyId,
      branchId: draft.branchId,
      userId: ACTOR,
      reason: 'E2E-CANCEL draft attempt',
    });
    expect(res.status).toBe(409);
  });

  it('cancels a POSTED opening (201 CANCELLED) — or refuses a re-cancel (409)', async () => {
    if (!target) {
      // eslint-disable-next-line no-console
      console.warn('  no opn0000% test voucher on this DB — happy path skipped');
      return;
    }
    const res = await request(app.getHttpServer()).post(ROUTE).set('Authorization', BEARER).send({
      svhId: target.svhId,
      accYear: target.accYear,
      companyId: target.companyId,
      branchId: target.branchId,
      userId: ACTOR,
      reason: 'E2E-CANCEL happy path via /stock/opening/cancel',
    });

    // eslint-disable-next-line no-console
    console.log(`\n[cancel e2e] HTTP ${res.status} — ${JSON.stringify(res.body)}\n`);

    if (target.status === 'POSTED') {
      // NestJS @Post defaults to 201; the route sets no @HttpCode(200) even
      // though Swagger documents it as 200 OK.
      expect(res.status).toBe(201);
      expect(res.body?.success).toBe(true);
      expect(res.body?.data?.status).toBe('CANCELLED');
      expect(res.body?.data?.rowsReversed).toBeGreaterThan(0);
    } else {
      // Already CANCELLED from a prior run — cancelling again is refused.
      expect(res.status).toBe(409);
    }

    const after = await prisma.$queryRawUnsafe<Array<{ svh_status: string }>>(
      `SELECT svh_status FROM stock.stock_voucher WHERE svh_id = $1::uuid`,
      target.svhId,
    );
    expect(after[0]?.svh_status).toBe('CANCELLED');
  });
});
