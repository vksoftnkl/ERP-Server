import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * NOTES 73 over HTTP, against the live dev data: a blank company on an item
 * means SHARED. Every call is a read or a refusal — nothing here writes.
 *
 *   A  /stock/opening/item-lookup opens a shared item, still refuses another
 *      company's; /items/bulk-load takes shared and company-wide items.
 *   B  grid 71 (POPUP - ITEMS) lists the company's items plus the shared ones,
 *      and with no grid_param (the React quotation picker) still lists all.
 *   C  /items/create refuses a branch without a company, or another company's.
 *
 *     npm run test:e2e -- item-company-scope-notes-73-http
 */

const BEARER = 'Bearer dummy-test-token';
const prisma = new PrismaClient();

interface Scope {
  companyId: string;
  branchId: string;
  sharedItemId: string;
  sharedItemName: string;
  otherCompanyItemId: string;
  otherCompanyId: string;
  groupId: string;
}

describe('Item company scope, notes 73 (HTTP — read-only)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let scope: Scope | null = null;

  beforeAll(async () => {
    // A shared item (blank company) whose branch, if any, is a branch of a
    // company that also owns items, and an item of some OTHER company.
    const [row] = await prisma.$queryRaw<Array<Scope>>`
      SELECT b.br_comp_id         AS "companyId",
             b.br_id              AS "branchId",
             s.item_id            AS "sharedItemId",
             s.item_name_en       AS "sharedItemName",
             o.item_id            AS "otherCompanyItemId",
             o.item_company_id    AS "otherCompanyId",
             s.item_group_id      AS "groupId"
        FROM inventory.item_master s
        JOIN public.branch_master b ON b.br_id = s.item_branch_id AND NOT b.br_is_deleted
        JOIN LATERAL (
               SELECT o.item_id, o.item_company_id FROM inventory.item_master o
                WHERE o.item_company_id IS NOT NULL AND o.item_company_id <> b.br_comp_id
                  AND o.item_is_active AND NOT o.item_is_deleted
                LIMIT 1) o ON true
       WHERE s.item_company_id IS NULL AND s.item_is_active AND NOT s.item_is_deleted
         AND EXISTS (SELECT 1 FROM inventory.item_unit_conversion c
                      WHERE c.iuc_item_id = s.item_id AND c.iuc_is_default_unit
                        AND COALESCE(c.iuc_is_deleted, false) = false)
       ORDER BY s.item_name_en
       LIMIT 1`;
    scope = row ?? null;
    const [user] = await prisma.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE NOT usr_is_deleted LIMIT 1`;
    const claims: AccessTokenPayload = {
      sub: user.usr_id,
      user_name: 'e2e-notes-73',
      sid: 'e2e-notes-73-session',
      user_type: 'SUPER ADMIN',
      company_id: scope?.companyId ?? (null as unknown as string),
      branch_id: scope?.branchId ?? (null as unknown as string),
      device_id: null as unknown as string,
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

  const today = new Date().toISOString().slice(0, 10);

  it('A. opening stock opens a shared item; another company’s item is still refused', async () => {
    if (!scope) return;
    const shared = await http
      .get('/api/v1/stock/opening/item-lookup')
      .set('Authorization', BEARER)
      .query({
        companyId: scope.companyId,
        branchId: scope.branchId,
        itemId: scope.sharedItemId,
        onDate: today,
      });
    expect(shared.status).toBe(200);
    expect(shared.body.data).toMatchObject({ itemId: scope.sharedItemId });
    expect(typeof shared.body.data.trackSignature).toBe('string');
    expect(typeof shared.body.data.unitName).toBe('string');

    const other = await http
      .get('/api/v1/stock/opening/item-lookup')
      .set('Authorization', BEARER)
      .query({ companyId: scope.companyId, itemId: scope.otherCompanyItemId, onDate: today });
    expect(other.status).toBe(404);
    expect(JSON.stringify(other.body)).toContain('belongs to another company');
  });

  it('A. /items/bulk-load takes the company’s items, the shared ones and the company-wide ones', async () => {
    if (!scope) return;
    const res = await http
      .get('/api/v1/items/bulk-load')
      .set('Authorization', BEARER)
      .query({ item_company_id: scope.companyId, item_branch_id: scope.branchId, limit: 5000 });
    expect(res.status).toBe(200);
    const ids = new Set((res.body.data as Array<{ item_id: string }>).map((i) => i.item_id));
    expect(ids.has(scope.sharedItemId)).toBe(true);
    expect(ids.has(scope.otherCompanyItemId)).toBe(false);
    const [scoped] = await prisma.$queryRaw<Array<{ n: bigint; wide: bigint }>>`
      SELECT count(*) AS n,
             count(*) FILTER (WHERE item_branch_id IS NULL) AS wide
        FROM inventory.item_master
       WHERE item_is_active AND NOT item_is_deleted
         AND (item_company_id IS NULL OR item_company_id = ${scope.companyId}::uuid)
         AND (item_branch_id IS NULL OR item_branch_id = ${scope.branchId}::uuid)`;
    expect(ids.size).toBe(Math.min(Number(scoped.n), 5000));
    expect(Number(scoped.wide)).toBeGreaterThan(0);
  });

  it('B. grid 71 lists the company’s and the shared items, never another company’s', async () => {
    if (!scope) return;
    const run = (params: Record<string, string>) =>
      http
        .get('/api/v1/configured-grid-sql/run')
        .set('Authorization', BEARER)
        .query({ grid_id: '71', limit: '100', ...params });

    const scoped = await run({
      grid_param: JSON.stringify({
        iitem_company_id: scope.companyId,
        iitem_branch_id: scope.branchId,
      }),
      search: scope.sharedItemName,
    });
    expect(scoped.status).toBe(200);
    const scopedIds = (scoped.body.data.items as Array<{ item_id: string }>).map((r) => r.item_id);
    expect(scopedIds).toContain(scope.sharedItemId);
    const owners = await prisma.$queryRaw<Array<{ company: string | null }>>`
      SELECT DISTINCT item_company_id::text AS company FROM inventory.item_master
       WHERE item_id = ANY(${scopedIds}::uuid[])`;
    for (const { company } of owners) {
      expect([null, scope.companyId]).toContain(company);
    }

    // The other company's item does not appear even when searched by name.
    const [other] = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT item_name_en AS name FROM inventory.item_master WHERE item_id = ${scope.otherCompanyItemId}::uuid`;
    const otherSearch = await run({
      grid_param: JSON.stringify({ iitem_company_id: scope.companyId }),
      search: other.name,
    });
    expect(otherSearch.status).toBe(200);
    expect(
      (otherSearch.body.data.items as Array<{ item_id: string }>).map((r) => r.item_id),
    ).not.toContain(scope.otherCompanyItemId);

    // No grid_param (the React quotation picker): the filters are off, as before.
    const unscoped = await run({ search: other.name });
    expect(unscoped.status).toBe(200);
    expect(
      (unscoped.body.data.items as Array<{ item_id: string }>).map((r) => r.item_id),
    ).toContain(scope.otherCompanyItemId);
  });

  it('C. /items/create refuses a branch without a company, or another company’s branch', async () => {
    if (!scope) return;
    const base = {
      item_name_en: 'ZT73-never-saved',
      item_group_id: scope.groupId,
      item_branch_id: scope.branchId,
    };
    const noCompany = await http
      .post('/api/v1/items/create')
      .set('Authorization', BEARER)
      .send(base);
    expect(noCompany.status).toBe(400);
    expect(JSON.stringify(noCompany.body)).toContain('item_branch_id');

    const wrongCompany = await http
      .post('/api/v1/items/create')
      .set('Authorization', BEARER)
      .send({ ...base, item_company_id: scope.otherCompanyId });
    expect(wrongCompany.status).toBe(400);
    expect(JSON.stringify(wrongCompany.body)).toContain('belongs to another company');

    const [saved] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM inventory.item_master WHERE item_name_en = 'ZT73-never-saved'`;
    expect(Number(saved.n)).toBe(0);
  });
});
