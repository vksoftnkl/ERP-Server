import '../src/env.preload';

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { createHouseValidationPipe } from '../src/common/validation/house-validation';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';

/**
 * /mobile/customers/* over HTTP, against the live dev DB (see memory
 * erp-server-http-testing-without-credentials): the real guard, house pipe,
 * versioning, prefix and filters run; only the token is stubbed.
 *
 * Writes ONE throwaway customer (ZT-MOBILE-CUS <ts>) and its linked ledger,
 * then soft-deletes both through the route, as the desktop delete does.
 */

const BASE = '/api/v1/mobile/customers';
const BEARER = 'Bearer dummy-test-token';
// VKPOS holds the menu-10 delete right; the company with the customer books on dev.
const ACTOR = '019e441b-6e48-7918-b246-b857ffb35db1';
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';

const prisma = new PrismaClient();

interface ListItem {
  cusId: string;
  cusName: string | null;
  cusGstType: string | null;
  cusIsActive: boolean;
  balance: { amount: string; side: 'DR' | 'CR' } | null;
  balanceStatus: string | null;
}

/** Independent of the service: opening set + counted legs, this year, up to today. */
async function closingOf(ledId: string, accYear: string): Promise<Prisma.Decimal> {
  const [row] = await prisma.$queryRaw<{ bal: Prisma.Decimal }[]>`
    SELECT (SELECT COALESCE(SUM(CASE op_dr_cr WHEN 'D' THEN op_amount ELSE -op_amount END), 0)
              FROM accounts.acc_opening_balance
             WHERE op_company_id = ${COMPANY}::uuid AND op_ledger_id = ${ledId}::uuid
               AND op_acc_year = ${accYear}::char(9) AND op_is_deleted = false)
         + (SELECT COALESCE(SUM(v.av_signed_amount), 0)
              FROM accounts.acc_vouchers v
              JOIN accounts.acc_voucher_header h
                ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
             WHERE v.av_company_id = ${COMPANY}::uuid AND v.av_ledger_id = ${ledId}::uuid
               AND v.av_acc_year = ${accYear}::char(9) AND v.av_voucher_date <= CURRENT_DATE
               AND v.av_is_deleted = false AND h.avh_is_deleted = false
               AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')) AS bal`;
  return new Prisma.Decimal(row.bal);
}

const signed = (b: { amount: string; side: 'DR' | 'CR' }) =>
  new Prisma.Decimal(b.amount).times(b.side === 'CR' ? -1 : 1);

describe('/mobile/customers (e2e, live DB)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const name = `ZT-MOBILE-CUS ${stamp}`;
  const phone = `9${String(stamp).slice(-9)}`;
  let createdId: string | null = null;
  let form: Record<string, unknown>;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'VKPOS',
      sid: 'e2e-mobile-customers',
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
  });

  afterAll(async () => {
    // A failed run must not leave a live ZT customer behind.
    if (createdId) {
      await http()
        .delete(`${BASE}/delete`)
        .query({ cusId: createdId })
        .set('Authorization', BEARER);
    }
    await app?.close();
    await prisma.$disconnect();
  });

  it('@OptionalAuth: no token reads, but with no company there are no balances', async () => {
    const res = await http().get(`${BASE}/list`).query({ pageSize: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.accYear).toBeNull();
    expect(res.body.data.balanceAsOn).toBeNull();
    expect(res.body.data.counts.outstanding).toBe(0);
    for (const i of res.body.data.items as ListItem[]) {
      expect(i.balance).toBeNull();
      expect(i.balanceStatus).toBeNull();
    }
    expect((await http().get(`${BASE}/options`)).status).toBe(200);
  });

  it('@OptionalAuth: a token that is sent is still checked', async () => {
    const res = await http().get(`${BASE}/list`).set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('options: every picker the form needs', async () => {
    const res = await http().get(`${BASE}/options`).set('Authorization', BEARER);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.areas.length).toBeGreaterThan(0);
    expect(d.groups.length).toBeGreaterThan(0);
    expect(d.priceLevels.length).toBeGreaterThan(0);
    expect(d.states).toEqual(expect.arrayContaining([{ code: '33', name: expect.any(String) }]));
    expect(d.gstTypes).toEqual(expect.arrayContaining(['REGULAR', 'UNREGISTERED']));
    const tn = d.states.find((s: { code: string }) => s.code === '33');
    form = {
      cusName: name,
      cusShort: 'ZTM',
      cusContactPerson: 'R. Velmurugan',
      cusPhone1: phone,
      cusWhatsappNo: phone,
      cusEmail: 'zt-mobile@example.com',
      cusAddr1: 'Near Bus Stand',
      cusCity: 'Namakkal',
      cusPin: '637001',
      cusDistrict: 'Namakkal',
      cusStateCode: tn.code,
      cusStateName: tn.name,
      cusGstType: 'UNREGISTERED',
      cusAreaId: d.areas[0].id,
      cusGroupId: d.groups[0].id,
      cusPriceLevelId: d.priceLevels[0].id,
    };
  });

  it('list: counts, paging, sort and the year it reads balances from', async () => {
    const res = await http()
      .get(`${BASE}/list`)
      .query({ pageSize: 20 })
      .set('Authorization', BEARER);
    expect(res.status).toBe(200);
    const d = res.body.data;
    const [live] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM sales.customers WHERE cus_is_deleted = false`;
    expect(d.counts.all).toBe(live.n);
    expect(d.total).toBe(live.n);
    expect(d.items.length).toBe(Math.min(20, live.n));
    expect(d.hasMore).toBe(live.n > 20);
    expect(d.accYear).toBe('2026-2027');
    expect(d.balanceAsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Name order is the database collation's (glibc: "test2" before "test opening bal").
    const firstPage = await prisma.$queryRaw<{ cus_id: string }[]>`
      SELECT cus_id::text FROM sales.customers WHERE cus_is_deleted = false
       ORDER BY lower(cus_name) NULLS LAST, cus_id LIMIT 20`;
    expect(d.items.map((i: ListItem) => i.cusId)).toEqual(firstPage.map((r) => r.cus_id));
    const second = await http()
      .get(`${BASE}/list`)
      .query({ pageSize: 20, page: 2 })
      .set('Authorization', BEARER);
    const pageTwoIds = second.body.data.items.map((i: ListItem) => i.cusId);
    expect(pageTwoIds.some((id: string) => firstPage.some((r) => r.cus_id === id))).toBe(false);
    expect(res.headers['x-cache']).not.toBe('HIT');
  });

  it('list OUTSTANDING: every row owes us, and the figure is the ledger closing', async () => {
    const res = await http()
      .get(`${BASE}/list`)
      .query({ filter: 'OUTSTANDING', pageSize: 200 })
      .set('Authorization', BEARER);
    expect(res.status).toBe(200);
    const items: ListItem[] = res.body.data.items;
    expect(res.body.data.total).toBe(res.body.data.counts.outstanding);
    for (const i of items) {
      expect(i.balance?.side).toBe('DR');
      expect(['OUTSTANDING', 'OVER_LIMIT']).toContain(i.balanceStatus);
    }
    for (const i of items.slice(0, 5)) {
      const expected = await closingOf(i.cusId, '2026-2027');
      expect(signed(i.balance!).toFixed(2)).toBe(expected.toFixed(2));
    }
  });

  it('list INACTIVE and UNREGISTERED keep to their chip', async () => {
    const inactive = await http()
      .get(`${BASE}/list`)
      .query({ filter: 'INACTIVE', pageSize: 200 })
      .set('Authorization', BEARER);
    expect(inactive.body.data.items.every((i: ListItem) => !i.cusIsActive)).toBe(true);
    const unreg = await http()
      .get(`${BASE}/list`)
      .query({ filter: 'UNREGISTERED', pageSize: 200 })
      .set('Authorization', BEARER);
    expect(
      unreg.body.data.items.every((i: ListItem) =>
        ['UNREGISTERED', '', null].includes(i.cusGstType?.trim().toUpperCase() ?? null),
      ),
    ).toBe(true);
  });

  it('list refuses an unknown filter and an oversized page', async () => {
    const res = await http()
      .get(`${BASE}/list`)
      .query({ filter: 'OVERDUE', pageSize: 500 })
      .set('Authorization', BEARER);
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(
      expect.arrayContaining(['filter', 'pageSize']),
    );
  });

  it('@OptionalAuth: no-token create and update work, delete needs the token', async () => {
    const anonName = `${name} ANON`;
    const created = await http()
      .post(`${BASE}/create`)
      .send({ ...form, cusName: anonName, cusPhone1: null, cusWhatsappNo: null });
    expect(created.status).toBe(201);
    createdId = created.body.data.cusId as string;
    const [stamp] = await prisma.$queryRaw<{ by: string | null }[]>`
      SELECT cus_created_by AS by FROM sales.customers WHERE cus_id = ${createdId}::uuid`;
    expect(stamp.by).toBe('00000000-0000-0000-0000-000000000000');

    const got = await http().get(`${BASE}/get`).query({ cusId: createdId });
    expect(got.status).toBe(200);
    expect(got.body.data).toEqual(expect.objectContaining({ balance: null, balanceStatus: null }));

    const updated = await http()
      .put(`${BASE}/update`)
      .send({
        ...form,
        cusId: createdId,
        cusName: `${anonName} B`,
        cusPhone1: null,
        cusWhatsappNo: null,
      });
    expect(updated.status).toBe(200);

    const check = await http().get(`${BASE}/delete-check`).query({ cusId: createdId });
    expect(check.status).toBe(403);
    const anonDelete = await http().delete(`${BASE}/delete`).query({ cusId: createdId });
    expect(anonDelete.status).toBe(403);

    const deleted = await http()
      .delete(`${BASE}/delete`)
      .query({ cusId: createdId })
      .set('Authorization', BEARER);
    expect(deleted.status).toBe(200);
    createdId = null;
  });

  it('create refuses a cusId', async () => {
    const res = await http()
      .post(`${BASE}/create`)
      .set('Authorization', BEARER)
      .send({ ...form, cusId: '019c6f6c-be87-7a11-8905-36092c46e101' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      expect.objectContaining({ field: 'cusId', code: 'VALIDATION_WHITELIST' }),
    ]);
  });

  it('create → get → search → update → delete-check → delete', async () => {
    const created = await http().post(`${BASE}/create`).set('Authorization', BEARER).send(form);
    expect(created.status).toBe(201);
    createdId = created.body.data.cusId as string;
    expect(created.body.message).toBe('Customer created successfully');

    // The desktop rules ran: a ledger with the same id, under the area's group.
    const [ledger] = await prisma.$queryRaw<{ led_name: string; led_group_id: string }[]>`
      SELECT led_name, led_group_id::text FROM accounts.acc_ledger_master
       WHERE led_id = ${createdId}::uuid AND led_is_deleted = false`;
    expect(ledger).toEqual({ led_name: name, led_group_id: form.cusAreaId });

    const got = await http()
      .get(`${BASE}/get`)
      .query({ cusId: createdId })
      .set('Authorization', BEARER);
    expect(got.status).toBe(200);
    expect(got.body.data).toEqual(
      expect.objectContaining({
        cusId: createdId,
        cusName: name,
        cusAreaName: expect.any(String),
        balance: { amount: '0.00', side: 'DR' },
        balanceStatus: 'SETTLED',
      }),
    );

    const spaced = `${phone.slice(0, 5)} ${phone.slice(5)}`;
    for (const search of [name.toLowerCase(), spaced]) {
      const found = await http().get(`${BASE}/list`).query({ search }).set('Authorization', BEARER);
      expect(found.body.data.items.map((i: ListItem) => i.cusId)).toContain(createdId);
      expect(found.body.data.counts.all).toBeGreaterThanOrEqual(1);
    }

    const noId = await http().put(`${BASE}/update`).set('Authorization', BEARER).send(form);
    expect(noId.status).toBe(400);

    const renamed = `${name} B`;
    const updated = await http()
      .put(`${BASE}/update`)
      .set('Authorization', BEARER)
      .send({ ...form, cusId: createdId, cusName: renamed });
    expect(updated.status).toBe(200);
    expect(updated.body.data.cusName).toBe(renamed);
    const [synced] = await prisma.$queryRaw<{ led_name: string }[]>`
      SELECT led_name FROM accounts.acc_ledger_master WHERE led_id = ${createdId}::uuid`;
    expect(synced.led_name).toBe(renamed);

    const check = await http()
      .get(`${BASE}/delete-check`)
      .query({ cusId: createdId })
      .set('Authorization', BEARER);
    expect(check.status).toBe(200);
    expect(check.body.data.canDelete).toBe(true);

    const deleted = await http()
      .delete(`${BASE}/delete`)
      .query({ cusId: createdId })
      .set('Authorization', BEARER);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ cusId: createdId, deleted: true });

    const gone = await http()
      .get(`${BASE}/get`)
      .query({ cusId: createdId })
      .set('Authorization', BEARER);
    expect(gone.status).toBe(404);
    expect(gone.body.errors[0].code).toBe('CUSTOMER_NOT_FOUND');
    const [row] = await prisma.$queryRaw<{ cus: boolean; led: boolean }[]>`
      SELECT c.cus_is_deleted AS cus, l.led_is_deleted AS led
        FROM sales.customers c JOIN accounts.acc_ledger_master l ON l.led_id = c.cus_id
       WHERE c.cus_id = ${createdId}::uuid`;
    expect(row).toEqual({ cus: true, led: true });
    createdId = null;
  });
});
