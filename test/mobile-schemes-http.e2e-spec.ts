import '../src/env.preload';

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { createHouseValidationPipe } from '../src/common/validation/house-validation';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';

/**
 * GET /mobile/schemes/active over HTTP against the live dev DB (memory
 * erp-server-http-testing-without-credentials): the real guard, house pipe,
 * versioning, prefix and filters; only the token is stubbed.
 *
 * READ-ONLY: writes nothing. Every expectation is read back from the DB with
 * its own SQL, so it holds for whatever schemes dev has today.
 */

const API = '/api/v1';
const ROUTE = `${API}/mobile/schemes/active`;
const ACTOR = '019e441b-6e48-7918-b246-b857ffb35db1'; // VKPOS
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Amazon Retail
const HARNESS_UID = 'E2E-SALES-HARNESS';

const prisma = new PrismaClient();

const HEADER_KEYS = [
  'prm_id',
  'prm_comp_id',
  'prm_branch_id',
  'prm_code',
  'prm_name',
  'prm_status',
  'prm_apply_on',
  'prm_benefit',
  'prm_priority',
  'prm_stack_mode',
  'prm_auto_apply',
  'prm_allow_with_manual_disc',
  'prm_calc_on_amount_type',
  'prm_include_tax',
  'prm_bill_type',
  'prm_min_bill_amount',
  'prm_min_qty',
  'prm_branch_scope',
  'prm_cust_scope',
  'prm_item_scope',
  'prm_price_level_id',
  'prm_max_benefit_per_bill',
  'prm_coupon_batch_id',
  'prm_start_date',
  'prm_end_date',
  'prm_valid_from_time',
  'prm_valid_to_time',
  'prm_valid_weekdays',
  'prm_remarks',
  'prm_modified_on',
  'branches',
  'parties',
  'items',
  'slabs',
];
const CHILD_KEYS = {
  branches: ['prb_id', 'prb_branch_id', 'prb_branch_name', 'prb_is_exclude'],
  parties: [
    'prp_id',
    'prp_kind',
    'prp_scope_id',
    'prp_scope_name',
    'prp_is_exclude',
    'prp_match_priority',
  ],
  items: [
    'pri_id',
    'pri_kind',
    'pri_scope_id',
    'pri_scope_name',
    'pri_unit_id',
    'pri_unit_name',
    'pri_is_exclude',
    'pri_disc_perc',
    'pri_disc_qty',
    'pri_disc_amt',
    'pri_min_qty',
    'pri_factor',
    'pri_max_benefit',
    'pri_match_priority',
  ],
  slabs: [
    'prs_id',
    'prs_slno',
    'prs_benefit',
    'prs_exceeds',
    'prs_upto',
    'prs_each',
    'prs_is_repeat',
    'prs_max_repeats',
    'prs_free_item_id',
    'prs_free_item_name',
    'prs_free_unit_id',
    'prs_free_unit_name',
    'prs_free_unit_factor',
    'prs_free_qty',
    'prs_free_stock_check',
    'prs_disc_perc',
    'prs_disc_qty',
    'prs_disc_amt',
    'prs_fixed_price',
    'prs_max_benefit_amt',
  ],
} as const;

type Row = Record<string, unknown>;
interface Scheme extends Row {
  prm_id: string;
  prm_code: string;
  branches: Row[];
  parties: Row[];
  items: Row[];
  slabs: Row[];
}

describe('/mobile/schemes/active (e2e, live DB, read-only)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'VKPOS',
      sid: 'e2e-mobile-schemes',
      user_type: 'SUPER ADMIN',
      company_id: COMPANY,
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
    app.useGlobalPipes(createHouseValidationPipe());
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('no token: 200 with exactly the schemes the phone can apply, in priority order', async () => {
    const res = await http().get(ROUTE).query({ companyId: COMPANY });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, message: 'Active schemes fetched' }),
    );
    const d = res.body.data as { companyId: string; asOf: string; schemes: Scheme[] };
    expect(Object.keys(d)).toEqual(['companyId', 'asOf', 'schemes']);
    expect(d.companyId).toBe(COMPANY);
    const [{ today }] = await prisma.$queryRaw<{ today: string }[]>`
      SELECT CURRENT_DATE::text AS today`;
    expect(d.asOf).toBe(today);

    const expected = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p.prm_id::text AS id FROM sales.promotion_scheme p
       WHERE p.prm_comp_id = ${COMPANY}::uuid AND p.prm_is_deleted = false
         AND p.prm_is_active = true AND p.prm_status = 'APPROVED' AND p.prm_auto_apply = true
         AND p.prm_coupon_batch_id IS NULL AND p.prm_end_date >= CURRENT_DATE
       ORDER BY p.prm_priority, p.prm_code, p.prm_id`;
    expect(d.schemes.map((s) => s.prm_id)).toEqual(expected.map((e) => e.id));

    // Plan §10.1: FRRE and ZT-SR-PROMO on dev; nothing suspended, draft, deleted, off or coupon.
    const codes = d.schemes.map((s) => s.prm_code);
    expect(codes).toEqual(expect.arrayContaining(['FRRE', 'ZT-SR-PROMO']));
    const refused = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p.prm_id::text AS id FROM sales.promotion_scheme p
       WHERE p.prm_comp_id = ${COMPANY}::uuid
         AND (p.prm_is_deleted OR NOT p.prm_is_active OR p.prm_status <> 'APPROVED'
              OR NOT p.prm_auto_apply OR p.prm_coupon_batch_id IS NOT NULL
              OR p.prm_end_date < CURRENT_DATE)`;
    expect(refused.length).toBeGreaterThan(0);
    const sent = new Set(d.schemes.map((s) => s.prm_id));
    expect(refused.filter((r) => sent.has(r.id))).toEqual([]);
  }, 60_000);

  it('keys exactly §6.1; integers as numbers, numerics as exact text at column scale', async () => {
    const res = await http().get(ROUTE).query({ companyId: COMPANY });
    const schemes = res.body.data.schemes as Scheme[];
    expect(schemes.length).toBeGreaterThan(0);
    for (const s of schemes) {
      expect(Object.keys(s)).toEqual(HEADER_KEYS);
      expect(typeof s.prm_priority).toBe('number');
      expect(s.prm_min_bill_amount).toMatch(/^-?\d+\.\d{2}$/);
      expect(s.prm_min_qty).toMatch(/^-?\d+\.\d{3}$/);
      expect(s.prm_start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const kind of ['branches', 'parties', 'items', 'slabs'] as const) {
        for (const row of s[kind]) {
          expect(Object.keys(row)).toEqual(CHILD_KEYS[kind]);
        }
      }
      for (const i of s.items) {
        expect(i.pri_disc_perc).toMatch(/^-?\d+\.\d{4}$/);
        expect(i.pri_min_qty).toMatch(/^-?\d+\.\d{3}$/);
        expect(typeof i.pri_match_priority).toBe('number');
      }
      for (const b of s.slabs) {
        expect(typeof b.prs_slno).toBe('number');
        expect(b.prs_exceeds).toMatch(/^-?\d+\.\d{3}$/);
        expect(b.prs_upto === null || /^-?\d+\.\d{3}$/.test(b.prs_upto as string)).toBe(true);
      }
    }
  }, 60_000);

  it('children: only live, active rows, equal to the DB; the free unit factor from the conversion', async () => {
    const res = await http().get(ROUTE).query({ companyId: COMPANY });
    const schemes = res.body.data.schemes as Scheme[];
    const ids = schemes.map((s) => s.prm_id);
    const counts = await prisma.$queryRaw<
      { id: string; b: number; p: number; i: number; s: number }[]
    >`
      SELECT p.prm_id::text AS id,
        (SELECT count(*)::int FROM sales.promotion_scheme_branch x
          WHERE x.prb_prm_id = p.prm_id AND NOT x.prb_is_deleted AND x.prb_is_active) AS b,
        (SELECT count(*)::int FROM sales.promotion_scheme_party x
          WHERE x.prp_prm_id = p.prm_id AND NOT x.prp_is_deleted AND x.prp_is_active) AS p,
        (SELECT count(*)::int FROM sales.promotion_scheme_item x
          WHERE x.pri_prm_id = p.prm_id AND NOT x.pri_is_deleted AND x.pri_is_active) AS i,
        (SELECT count(*)::int FROM sales.promotion_scheme_slab x
          WHERE x.prs_prm_id = p.prm_id AND NOT x.prs_is_deleted AND x.prs_is_active) AS s
        FROM sales.promotion_scheme p WHERE p.prm_id = ANY(${ids}::uuid[])`;
    for (const c of counts) {
      const s = schemes.find((x) => x.prm_id === c.id)!;
      expect([s.branches.length, s.parties.length, s.items.length, s.slabs.length]).toEqual([
        c.b,
        c.p,
        c.i,
        c.s,
      ]);
    }
    const slabs = schemes.flatMap((s) => s.slabs).filter((b) => b.prs_free_unit_id);
    for (const b of slabs) {
      const [{ f }] = await prisma.$queryRaw<{ f: Prisma.Decimal }[]>`
        SELECT iuc_to_base_factor AS f FROM inventory.item_unit_conversion
         WHERE iuc_id = ${String(b.prs_free_unit_id)}::uuid`;
      expect(b.prs_free_unit_factor).toBe(new Prisma.Decimal(f).toFixed(6));
    }
  }, 60_000);

  it('a registered phone reads the same; refusals are coded', async () => {
    const plain = await http().get(ROUTE).query({ companyId: COMPANY });
    const phone = await http().get(ROUTE).query({ companyId: COMPANY, deviceUid: HARNESS_UID });
    expect(phone.status).toBe(200);
    expect(phone.body.data.schemes).toEqual(plain.body.data.schemes);

    const noCompany = await http().get(ROUTE);
    expect(noCompany.status).toBe(400);
    expect(noCompany.body.errors[0]).toEqual(
      expect.objectContaining({ field: 'companyId', code: 'VALIDATION_IS_UUID' }),
    );

    const unknown = await http().get(ROUTE).query({ companyId: randomUUID() });
    expect(unknown.status).toBe(404);
    expect(unknown.body.errors[0].code).toBe('MOBILE_COMPANY_NOT_FOUND');

    const stranger = await http()
      .get(ROUTE)
      .query({ companyId: COMPANY, deviceUid: `ZT-NOPE-${Date.now()}` });
    expect(stranger.status).toBe(403);
    expect(stranger.body.errors[0].code).toBe('MOBILE_DEVICE_NOT_REGISTERED');

    const extra = await http().get(ROUTE).query({ companyId: COMPANY, branchId: randomUUID() });
    expect(extra.status).toBe(400);
    expect(extra.body.errors[0].field).toBe('branchId');
  }, 60_000);
});
