// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';

/**
 * HTTP-level test for /api/v1/ledger-map — the §8 checklist of the posting
 * ledger map plan, run against the live dev database.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard, so the real AccessTokenGuard, the global ValidationPipe,
 * URI versioning, the global prefix and the module's exception filter all run
 * and the status codes match the live server.
 *
 * ── WHAT IT MUTATES, AND HOW IT PUTS IT BACK ────────────────────────────────
 * PURCHASE_RETURN is the only mapping touched destructively: nothing posts that
 * role yet, which is precisely why the plan uses it for the delete case.
 * afterAll hard-deletes the row this suite created and un-deletes the original,
 * so the table ends with the same 28 rows, under the same ids, it started with.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const ROLES_ROUTE = '/api/v1/ledger-map/roles';
const CREATE_ROUTE = '/api/v1/ledger-map/create';
const DELETE_ROUTE = '/api/v1/ledger-map/delete';
const BEARER = 'Bearer dummy-test-token';
const NIL_BUT_VALID_UUID = '00000000-0000-4000-8000-000000000000';
/** tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor. */
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();

/**
 * The controller carries `@CacheTTL(1)` like every other read route here, so a
 * GET is served from cache for one second and the write-side invalidation is
 * fire-and-forget. A screen re-reading after a save never notices; a test
 * firing the next request a millisecond later does. Waiting the window out is
 * the honest way to assert what the NEXT read returns.
 */
const CACHE_WINDOW_MS = 1200;
const afterCacheWindow = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, CACHE_WINDOW_MS));

interface RolePayload {
  role: string;
  label: string;
  group: string;
  expectedLedgerType: string | null;
  usedBy: string[];
  almId: string | null;
  ledgerId: string | null;
  ledgerName: string | null;
  isActive: boolean | null;
}

async function liveMappingCount(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM accounts.acc_ledger_map WHERE NOT alm_is_deleted`,
  );
  return rows[0].n;
}

async function liveMappingIds(role: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ alm_id: string }>>(
    `SELECT alm_id FROM accounts.acc_ledger_map WHERE alm_role = $1 AND NOT alm_is_deleted`,
    role,
  );
  return rows.map((row) => row.alm_id);
}

async function findGlobalLedger(type: string): Promise<{ id: string; name: string } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ led_id: string; led_name: string }>>(
    `SELECT led_id, led_name
       FROM accounts.acc_ledger_master
      WHERE led_ledger_type = $1
        AND led_company_id IS NULL
        AND led_is_active AND NOT led_is_deleted
      ORDER BY led_name
      LIMIT 1`,
    type,
  );
  const row = rows[0];
  return row ? { id: row.led_id, name: row.led_name } : null;
}

describe('/ledger-map (e2e — live DB)', () => {
  let app: INestApplication;
  /** The mapping this suite deletes and re-creates. */
  let purchaseReturn: { almId: string; ledgerId: string } | null = null;
  /** The row the suite creates, hard-deleted in afterAll. */
  let createdAlmId: string | null = null;
  let bankLedger: { id: string; name: string } | null = null;
  let incomeLedger: { id: string; name: string } | null = null;
  let startingCount = 0;

  beforeAll(async () => {
    startingCount = await liveMappingCount();
    const rows = await prisma.$queryRawUnsafe<Array<{ alm_id: string; alm_ledger_id: string }>>(
      `SELECT alm_id, alm_ledger_id
         FROM accounts.acc_ledger_map
        WHERE alm_role = 'PURCHASE_RETURN' AND NOT alm_is_deleted`,
    );
    purchaseReturn = rows[0] ? { almId: rows[0].alm_id, ledgerId: rows[0].alm_ledger_id } : null;
    bankLedger = await findGlobalLedger('BANK');
    incomeLedger = await findGlobalLedger('INCOME');

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
  });

  afterAll(async () => {
    // Put PURCHASE_RETURN back exactly as it was: the created row goes, the
    // original comes back. In that order — ux_alm_role would refuse two live
    // rows for one role.
    if (createdAlmId) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM accounts.acc_ledger_map WHERE alm_id = $1::uuid`,
        createdAlmId,
      );
    }
    if (purchaseReturn) {
      await prisma.$executeRawUnsafe(
        `UPDATE accounts.acc_ledger_map
            SET alm_is_deleted = false, alm_is_active = true
          WHERE alm_id = $1::uuid`,
        purchaseReturn.almId,
      );
    }
    await app?.close();
    await prisma.$disconnect();
  });

  it('401 without an Authorization header', async () => {
    const res = await request(app.getHttpServer()).get(ROLES_ROUTE);
    expect(res.status).toBe(401);
  });

  // §8.1
  it('GET /roles returns every catalogue role, mapped or not', async () => {
    const res = await request(app.getHttpServer()).get(ROLES_ROUTE).set('Authorization', BEARER);
    expect(res.status).toBe(200);
    const roles: RolePayload[] = res.body.data;

    const catalogue = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM accounts.acc_ledger_role`,
    );
    expect(roles).toHaveLength(catalogue[0].n);

    const discount = roles.find((role) => role.role === 'DISCOUNT_ALLOWED');
    expect(discount).toBeDefined();
    // The label and the expected type are the screen's, and they come from the
    // catalogue — not from a list the client keeps.
    expect(discount!.label).toBe('Discount allowed');
    expect(discount!.expectedLedgerType).not.toBeNull();
    expect(discount!.ledgerId).not.toBeNull();
    expect(discount!.usedBy).toContain('RECEIPT');

    // A role nothing posts is reported with an empty usedBy — that is what
    // makes it safe to unmap.
    const purchaseReturnRole = roles.find((role) => role.role === 'PURCHASE_RETURN');
    expect(purchaseReturnRole!.usedBy).toEqual([]);
  });

  // §8.6
  it('400 when almCompanyId is sent, naming the field', async () => {
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({
        role: 'PURCHASE_RETURN',
        ledgerId: purchaseReturn?.ledgerId ?? NIL_BUT_VALID_UUID,
        almCompanyId: NIL_BUT_VALID_UUID,
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('almCompanyId');
    expect(JSON.stringify(res.body)).toContain('not accepted');
  });

  it('400 when almSupplyNature is sent', async () => {
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({
        role: 'PURCHASE_RETURN',
        ledgerId: purchaseReturn?.ledgerId ?? NIL_BUT_VALID_UUID,
        almSupplyNature: 'INTRA',
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('almSupplyNature');
  });

  // §8.4 — the check the schema cannot make.
  it('400 when DISCOUNT_ALLOWED is pointed at a BANK ledger, naming the type', async () => {
    if (!bankLedger) return;
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({ role: 'DISCOUNT_ALLOWED', ledgerId: bankLedger.id });
    expect(res.status).toBe(400);
    const body = JSON.stringify(res.body);
    expect(body).toContain(bankLedger.name);
    // The message names the type the role demands and the type the ledger is.
    expect(body).toContain('BANK');
  });

  // §8.5
  it('400 when OUTPUT_CGST is pointed at an INCOME ledger', async () => {
    if (!incomeLedger) return;
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({ role: 'OUTPUT_CGST', ledgerId: incomeLedger.id });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('TAX');
  });

  it('400 for a role the catalogue does not know, listing the roles it does', async () => {
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({ role: 'NOT_A_ROLE', ledgerId: purchaseReturn?.ledgerId ?? NIL_BUT_VALID_UUID });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('DISCOUNT_ALLOWED');
  });

  it('400 for a ledger that does not exist', async () => {
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({ role: 'PURCHASE_RETURN', ledgerId: NIL_BUT_VALID_UUID });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('ledgerId');
  });

  it('409 when a second mapping is added for a role that already has one', async () => {
    if (!purchaseReturn) return;
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({ role: 'PURCHASE_RETURN', ledgerId: purchaseReturn.ledgerId });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('PURCHASE_RETURN');
  });

  // §8.7 — the refusal that matters: unmapping a role a live engine posts.
  it('409 when DISCOUNT_ALLOWED is deleted, naming RECEIPT', async () => {
    const roles = await request(app.getHttpServer()).get(ROLES_ROUTE).set('Authorization', BEARER);
    const discount = (roles.body.data as RolePayload[]).find(
      (role) => role.role === 'DISCOUNT_ALLOWED',
    )!;
    const res = await request(app.getHttpServer())
      .delete(`${DELETE_ROUTE}?almId=${discount.almId}`)
      .set('Authorization', BEARER);
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('RECEIPT');
    // Refused means untouched.
    expect(await liveMappingIds('DISCOUNT_ALLOWED')).toEqual([discount.almId]);
  });

  it('404 when the mapping does not exist', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${DELETE_ROUTE}?almId=${NIL_BUT_VALID_UUID}`)
      .set('Authorization', BEARER);
    expect(res.status).toBe(404);
  });

  // §8.8
  it('deletes a role no engine posts, and /roles then shows it unmapped', async () => {
    if (!purchaseReturn) return;
    const res = await request(app.getHttpServer())
      .delete(`${DELETE_ROUTE}?almId=${purchaseReturn.almId}`)
      .set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'PURCHASE_RETURN', deleted: true });

    await afterCacheWindow();
    const roles = await request(app.getHttpServer()).get(ROLES_ROUTE).set('Authorization', BEARER);
    const role = (roles.body.data as RolePayload[]).find((r) => r.role === 'PURCHASE_RETURN')!;
    expect(role.almId).toBeNull();
    expect(role.ledgerId).toBeNull();
    expect(role.isActive).toBeNull();
  });

  // §8.2
  it('creates a mapping for the now-unmapped role, and /roles shows it', async () => {
    if (!purchaseReturn) return;
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({
        role: 'PURCHASE_RETURN',
        ledgerId: purchaseReturn.ledgerId,
        remarks: 'e2e — created by ledger-map-http.e2e-spec',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.ledgerId).toBe(purchaseReturn.ledgerId);
    createdAlmId = res.body.data.almId;
    expect(createdAlmId).not.toBeNull();

    await afterCacheWindow();
    const roles = await request(app.getHttpServer()).get(ROLES_ROUTE).set('Authorization', BEARER);
    const role = (roles.body.data as RolePayload[]).find((r) => r.role === 'PURCHASE_RETURN')!;
    expect(role.almId).toBe(createdAlmId);
    expect(role.ledgerName).not.toBeNull();
  });

  // §8.3 — re-pointing leaves ONE row, not two.
  it('re-points that mapping in place', async () => {
    if (!createdAlmId || !purchaseReturn) return;
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({
        almId: createdAlmId,
        role: 'PURCHASE_RETURN',
        ledgerId: purchaseReturn.ledgerId,
        remarks: 'e2e — re-pointed',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.remarks).toBe('e2e — re-pointed');
    expect(await liveMappingIds('PURCHASE_RETURN')).toEqual([createdAlmId]);
  });

  it('400 when an update tries to change the mapping to another role', async () => {
    if (!createdAlmId || !purchaseReturn) return;
    const res = await request(app.getHttpServer())
      .post(CREATE_ROUTE)
      .set('Authorization', BEARER)
      .send({ almId: createdAlmId, role: 'WRITE_OFF', ledgerId: purchaseReturn.ledgerId });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('PURCHASE_RETURN');
  });

  // §8.9
  it('leaves the table with the count it started with, and no duplicates', async () => {
    expect(await liveMappingCount()).toBe(startingCount);
    const duplicates = await prisma.$queryRawUnsafe<Array<{ alm_role: string }>>(
      `SELECT alm_role
         FROM accounts.acc_ledger_map
        WHERE NOT alm_is_deleted
        GROUP BY alm_role
       HAVING count(*) > 1`,
    );
    expect(duplicates).toEqual([]);
  });
});
