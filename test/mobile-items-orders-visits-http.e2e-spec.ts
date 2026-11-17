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
 * /mobile/items, /mobile/orders, /mobile/visits over HTTP against the live dev
 * DB (memory erp-server-http-testing-without-credentials): the real guard,
 * house pipe, versioning, prefix and filters; only the token is stubbed.
 *
 * Test-owned data only:
 *  - orders: every order this run creates carries a client uuid made here,
 *    and is deleted through DELETE /sale-orders/delete (it stays DRAFT);
 *  - visits: deleted by their client uuids (an insert-only table);
 *  - one blocked / one inactive device row (ZT-MOBILE-*), hard-deleted: no
 *    document can reference a refused phone.
 * The phone is the sales harness device (E2E-SALES-HARNESS, D9), registered to
 * COMPANY's Coimbatore branch.
 */

const API = '/api/v1';
const BEARER = 'Bearer dummy-test-token';
const ACTOR = '019e441b-6e48-7918-b246-b857ffb35db1'; // VKPOS
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const HARNESS_UID = 'E2E-SALES-HARNESS';

const prisma = new PrismaClient();

interface MobileUnit {
  iucId: string;
  factor: number;
  priced: boolean;
  priceA: string | null;
  priceB: string | null;
  mrp: string | null;
  minPrice: string | null;
  availableQty: number;
}
interface MobileItem {
  itemId: string;
  itemNameEn: string;
  availableBaseQty: number;
  units: MobileUnit[];
}

describe('/mobile items, orders, visits (e2e, live DB)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const orderUuids: string[] = [];
  const visitUuids: string[] = [];
  const zDeviceUids = [`ZT-MOBILE-BLOCKED-${stamp}`, `ZT-MOBILE-OFF-${stamp}`];
  let harness: { devId: string; devBranchId: string };
  let customerId: string;
  let otherCustomerId: string;
  let salesmanId: string;
  let orderItem: { itemId: string; iucId: string };

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'VKPOS',
      sid: 'e2e-mobile-orders',
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

    const [device] = await prisma.$queryRaw<{ devId: string; devBranchId: string }[]>`
      SELECT dev_id AS "devId", dev_branch_id AS "devBranchId" FROM fixed.device_master
       WHERE dev_device_uid = ${HARNESS_UID} AND dev_is_deleted = false`;
    harness = device;
    const customers = await prisma.$queryRaw<{ id: string }[]>`
      SELECT cus_id AS id FROM sales.customers
       WHERE cus_is_deleted = false AND cus_is_active = true AND cus_name NOT ILIKE 'ZT%'
       ORDER BY cus_created_on LIMIT 2`;
    [customerId, otherCustomerId] = customers.map((c) => c.id);
    const [emp] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT emp_id AS id FROM public.employee_master
       WHERE emp_is_deleted = false ORDER BY emp_created_on LIMIT 1`;
    salesmanId = emp.id;
    // A priced unit of an orderable item, at the harness branch.
    const [priced] = await prisma.$queryRaw<{ itemId: string; iucId: string }[]>`
      SELECT p.ipm_item_id AS "itemId", p.ipm_uc_unit_id AS "iucId"
        FROM inventory.item_price_master p
        JOIN inventory.item_master i ON i.item_id = p.ipm_item_id
        JOIN inventory.item_unit_conversion u ON u.iuc_id = p.ipm_uc_unit_id AND u.iuc_is_deleted = false
       WHERE p.ipm_is_deleted = false AND i.item_allow_so AND i.item_is_active AND NOT i.item_is_deleted
         AND (i.item_company_id IS NULL OR i.item_company_id = ${COMPANY}::uuid)
         AND (i.item_branch_id IS NULL OR i.item_branch_id = ${harness.devBranchId}::uuid)
         AND (p.ipm_company_id IS NULL OR p.ipm_company_id = ${COMPANY}::uuid)
         AND (p.ipm_branch_id IS NULL OR p.ipm_branch_id = ${harness.devBranchId}::uuid)
         AND CURRENT_DATE BETWEEN p.ipm_effective_from AND p.ipm_effective_to
         AND p.ipm_sales_price_a > 0
       ORDER BY i.item_name_en LIMIT 1`;
    orderItem = priced;
    await prisma.$executeRaw`
      INSERT INTO fixed.device_master (dev_device_uid, dev_device_name, dev_device_type, dev_is_blocked, dev_block_reason, dev_is_active)
      VALUES (${zDeviceUids[0]}, 'ZT mobile blocked', 'Mobile', true, 'lost phone', true),
             (${zDeviceUids[1]}, 'ZT mobile off', 'Mobile', false, NULL, false)`;
  }, 120_000);

  afterAll(async () => {
    const orders = orderUuids.length
      ? await prisma.$queryRaw<
          { soId: string; soBranchId: string; soAccYear: string; soIsDeleted: boolean }[]
        >`
          SELECT so_id AS "soId", so_branch_id AS "soBranchId", so_acc_year::text AS "soAccYear",
                 so_is_deleted AS "soIsDeleted"
            FROM sales.sale_order
           WHERE so_company_id = ${COMPANY}::uuid AND so_client_uuid = ANY(${orderUuids}::uuid[])`
      : [];
    for (const o of orders.filter((row) => !row.soIsDeleted)) {
      await http()
        .delete(`${API}/sale-orders/delete`)
        .query({
          soId: o.soId,
          soCompanyId: COMPANY,
          soBranchId: o.soBranchId,
          soAccYear: o.soAccYear.trim(),
        })
        .set('Authorization', BEARER);
    }
    if (visitUuids.length) {
      await prisma.$executeRaw`
        DELETE FROM sales.customer_visit
         WHERE cv_company_id = ${COMPANY}::uuid AND cv_client_uuid = ANY(${visitUuids}::uuid[])`;
    }
    await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_device_uid = ANY(${zDeviceUids})`;
    await app?.close();
    await prisma.$disconnect();
  }, 120_000);

  // ── items ───────────────────────────────────────────────────────────────
  describe('/mobile/items', () => {
    it('options: live companies, groups, brands; price levels without Cost', async () => {
      const res = await http().get(`${API}/mobile/items/options`);
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.companies.map((c: { id: string }) => c.id)).toContain(COMPANY);
      expect(d.companies.every((c: { place: unknown }) => 'place' in c)).toBe(true);
      expect(d.itemGroups.length).toBeGreaterThan(0);
      expect(d.itemGroups[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
      );
      expect(Array.isArray(d.brands)).toBe(true);
      const levelIds = d.priceLevels.map((l: { id: number }) => l.id);
      expect(levelIds).not.toContain(7);
      expect(levelIds).toContain(1);
    });

    it('list: the orderable count, sorted, no cost anywhere, prices = /master-lookups/item-price', async () => {
      const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM inventory.item_master i
         WHERE i.item_is_deleted = false AND i.item_is_active AND i.item_allow_so
           AND (i.item_company_id IS NULL OR i.item_company_id = ${COMPANY}::uuid)
           AND (i.item_branch_id IS NULL OR i.item_branch_id = ${harness.devBranchId}::uuid)`;
      const started = Date.now();
      const res = await http()
        .get(`${API}/mobile/items/list`)
        .query({ companyId: COMPANY, deviceUid: HARNESS_UID, pageSize: 500 });
      const elapsed = Date.now() - started;
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.total).toBe(n);
      expect(d.branchId).toBe(harness.devBranchId);
      expect(d.items.length).toBe(Math.min(500, n));
      expect(d.hasMore).toBe(n > 500);
      expect(JSON.stringify(res.body).toLowerCase()).not.toContain('cost');
      const names = (d.items as MobileItem[]).map((i) => i.itemNameEn.toLowerCase());
      // Sorted by lower(name) in the DB collation: spot-check it is not reversed.
      expect(names[0] <= names[names.length - 1] || names.length < 2).toBe(true);
      // eslint-disable-next-line no-console
      console.log(`mobile items page of 500: ${elapsed} ms`);
    }, 60_000);

    it('list: a priced unit answers what the desktop lookup answers (level 1, MRP, min)', async () => {
      // Find the priced item's page: its rank in the same order.
      const [{ rank }] = await prisma.$queryRaw<{ rank: number }[]>`
        SELECT r.rank::int AS rank FROM (
          SELECT i.item_id, row_number() OVER (ORDER BY lower(i.item_name_en), i.item_id) AS rank
            FROM inventory.item_master i
           WHERE i.item_is_deleted = false AND i.item_is_active AND i.item_allow_so
             AND (i.item_company_id IS NULL OR i.item_company_id = ${COMPANY}::uuid)
             AND (i.item_branch_id IS NULL OR i.item_branch_id = ${harness.devBranchId}::uuid)) r
         WHERE r.item_id = ${orderItem.itemId}::uuid`;
      const pageSize = 50;
      const page = Math.floor((rank - 1) / pageSize) + 1;
      const res = await http()
        .get(`${API}/mobile/items/list`)
        .query({ companyId: COMPANY, deviceUid: HARNESS_UID, page, pageSize });
      expect(res.status).toBe(200);
      const item = (res.body.data.items as MobileItem[]).find((i) => i.itemId === orderItem.itemId);
      expect(item).toBeDefined();
      const priced = item!.units.filter((u) => u.priced);
      expect(priced.length).toBeGreaterThan(0);
      for (const unit of priced) {
        const lookup = await http()
          .get(`${API}/master-lookups/item-price`)
          .query({
            item_id: orderItem.itemId,
            company_id: COMPANY,
            branch_id: harness.devBranchId,
            unit_id: unit.iucId,
            price_level: 1,
          })
          .set('Authorization', BEARER);
        expect(lookup.status).toBe(200);
        expect(lookup.body.data.item_uc_id).toBe(unit.iucId);
        expect(unit.priceA).toBe(new Prisma.Decimal(lookup.body.data.sales_price).toFixed(2));
        expect(unit.mrp).toBe(new Prisma.Decimal(lookup.body.data.max_price).toFixed(2));
        expect(unit.minPrice).toBe(new Prisma.Decimal(lookup.body.data.min_price).toFixed(2));
      }
      // Stock: free saleable in the company, base unit; per unit = base ÷ factor.
      const [{ qty }] = await prisma.$queryRaw<{ qty: Prisma.Decimal | null }[]>`
        SELECT SUM(sbl_available_qty) AS qty FROM stock.stock_balance
         WHERE sbl_item_id = ${orderItem.itemId}::uuid AND sbl_company_id = ${COMPANY}::uuid
           AND sbl_is_deleted = false AND sbl_bucket = 'SALEABLE'`;
      const base = new Prisma.Decimal(qty ?? 0);
      expect(item!.availableBaseQty).toBe(Number(base.toDecimalPlaces(3).toString()));
      for (const unit of item!.units) {
        expect(unit.availableQty).toBe(
          unit.factor > 0 ? Number(base.div(unit.factor).toDecimalPlaces(3).toString()) : 0,
        );
      }
    }, 60_000);

    it('list: past the end is an empty page; refusals are coded', async () => {
      const past = await http()
        .get(`${API}/mobile/items/list`)
        .query({ companyId: COMPANY, page: 100000 });
      expect(past.status).toBe(200);
      expect(past.body.data.items).toEqual([]);
      expect(past.body.data.total).toBeGreaterThan(0);
      expect(past.body.data.hasMore).toBe(false);

      const big = await http()
        .get(`${API}/mobile/items/list`)
        .query({ companyId: COMPANY, pageSize: 501 });
      expect(big.status).toBe(400);
      expect(big.body.errors[0].field).toBe('pageSize');

      const noCompany = await http()
        .get(`${API}/mobile/items/list`)
        .query({ companyId: randomUUID() });
      expect(noCompany.status).toBe(404);
      expect(noCompany.body.errors[0].code).toBe('MOBILE_COMPANY_NOT_FOUND');

      const unknown = await http()
        .get(`${API}/mobile/items/list`)
        .query({ companyId: COMPANY, deviceUid: `ZT-NOPE-${stamp}` });
      expect(unknown.status).toBe(403);
      expect(unknown.body.errors[0].code).toBe('MOBILE_DEVICE_NOT_REGISTERED');
    }, 60_000);
  });

  // ── orders ──────────────────────────────────────────────────────────────
  describe('/mobile/orders/create', () => {
    const orderBody = (clientUuid: string, extra: Record<string, unknown> = {}) => ({
      soClientUuid: clientUuid,
      deviceUid: HARNESS_UID,
      soCompanyId: COMPANY,
      soCustId: customerId,
      soCustName: 'ZT mobile order',
      soPriceLevel: 1,
      soRemarks: `ZT-MOBILE-ORDER ${stamp}`,
      items: [
        {
          soiItemId: orderItem.itemId,
          soiItemUnitId: orderItem.iucId,
          soiOrderQty: 2,
          soiNetQty: 2,
          soiRate: 10,
          soiNetAmt: 20,
        },
      ],
      ...extra,
    });
    const newUuid = () => {
      const id = randomUUID();
      orderUuids.push(id);
      return id;
    };

    it('saves a DRAFT with the server-filled device, branch, year, number and the login user', async () => {
      const uuid = newUuid();
      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(uuid));
      expect(res.status).toBe(201);
      const d = res.body.data;
      expect(d).toEqual(
        expect.objectContaining({ soStatus: 'DRAFT', duplicate: false, soIsDeleted: false }),
      );
      expect(d.soOrderRefno).toEqual(expect.any(String));
      const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT so_device_id::text AS device, so_branch_id::text AS branch, so_acc_year::text AS year,
               so_user_id::text AS "user", so_client_uuid::text AS uuid, so_order_refno AS refno,
               (SELECT count(*)::int FROM sales.sale_order_item i
                 WHERE i.soi_order_id = so.so_id AND i.soi_acc_year = so.so_acc_year
                   AND i.soi_is_deleted = false) AS lines
          FROM sales.sale_order so WHERE so.so_id = ${d.soId}::uuid`;
      expect(row).toEqual({
        device: harness.devId,
        branch: harness.devBranchId,
        year: d.soAccYear,
        user: ACTOR,
        uuid,
        refno: d.soOrderRefno,
        lines: 1,
      });
    }, 60_000);

    it('a resend answers the saved order and writes nothing; two at once save one', async () => {
      const uuid = newUuid();
      const first = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(uuid));
      expect(first.status).toBe(201);
      const again = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(uuid));
      expect(again.status).toBe(201);
      expect(again.body.data).toEqual({ ...first.body.data, duplicate: true });
      expect(again.body.message).toBe('Order already saved');

      const twin = newUuid();
      const [a, b] = await Promise.all([
        http()
          .post(`${API}/mobile/orders/create`)
          .set('Authorization', BEARER)
          .send(orderBody(twin)),
        http()
          .post(`${API}/mobile/orders/create`)
          .set('Authorization', BEARER)
          .send(orderBody(twin)),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body.data.soId).toBe(b.body.data.soId);
      expect([a.body.data.duplicate, b.body.data.duplicate].sort()).toEqual([false, true]);
      const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM sales.sale_order
         WHERE so_company_id = ${COMPANY}::uuid AND so_client_uuid = ${twin}::uuid`;
      expect(n).toBe(1);

      const reused = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(uuid, { soCustId: otherCustomerId }));
      expect(reused.status).toBe(409);
      expect(reused.body.errors[0].code).toBe('MOBILE_CLIENT_UUID_REUSED');
    }, 90_000);

    it('refuses an unknown, blocked or inactive phone, server-filled keys and an empty order', async () => {
      const cases: Array<[string, number, string]> = [
        [`ZT-NOPE-${stamp}`, 403, 'MOBILE_DEVICE_NOT_REGISTERED'],
        [zDeviceUids[0], 403, 'MOBILE_DEVICE_BLOCKED'],
        [zDeviceUids[1], 403, 'MOBILE_DEVICE_INACTIVE'],
      ];
      for (const [deviceUid, status, code] of cases) {
        const uuid = newUuid();
        const res = await http()
          .post(`${API}/mobile/orders/create`)
          .set('Authorization', BEARER)
          .send(orderBody(uuid, { deviceUid }));
        expect(res.status).toBe(status);
        expect(res.body.errors[0].code).toBe(code);
      }
      const branch = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(newUuid(), { soBranchId: harness.devBranchId }));
      expect(branch.status).toBe(400);
      expect(branch.body.errors[0].code).toBe('VALIDATION_WHITELIST');

      const empty = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(newUuid(), { items: [] }));
      expect(empty.status).toBe(400);
      expect(empty.body.errors[0].field).toBe('items');

      const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM sales.sale_order
         WHERE so_company_id = ${COMPANY}::uuid AND so_remarks = ${`ZT-MOBILE-ORDER ${stamp}`}`;
      expect(n).toBe(3); // the three saved above, nothing from the refusals
    }, 60_000);

    it('without a token: soUserId is required, and then it is the order user', async () => {
      const missing = await http().post(`${API}/mobile/orders/create`).send(orderBody(newUuid()));
      expect(missing.status).toBe(400);
      expect(missing.body.errors[0].code).toBe('MOBILE_ORDER_USER_REQUIRED');

      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .send(orderBody(newUuid(), { soUserId: ACTOR }));
      expect(res.status).toBe(201);
      const [row] = await prisma.$queryRaw<{ user: string }[]>`
        SELECT so_user_id::text AS "user" FROM sales.sale_order WHERE so_id = ${res.body.data.soId}::uuid`;
      expect(row.user).toBe(ACTOR);
    }, 60_000);
  });

  // ── visits ──────────────────────────────────────────────────────────────
  describe('/mobile/visits/create', () => {
    const visitBody = (clientUuid: string, extra: Record<string, unknown> = {}) => ({
      cvClientUuid: clientUuid,
      cvCompanyId: COMPANY,
      deviceUid: HARNESS_UID,
      cvCustId: customerId,
      cvSalesmanId: salesmanId,
      cvReasonCode: 'shopClosed',
      cvRemarks: 'ZT mobile visit',
      cvLatitude: 11.108512,
      cvLongitude: 77.341067,
      cvGpsAccuracy: 12.5,
      cvVisitAt: '2026-11-16T10:42:00+05:30',
      ...extra,
    });
    const newUuid = () => {
      const id = randomUUID();
      visitUuids.push(id);
      return id;
    };

    it("saves a check-in with the phone's device and branch and the login user; a resend writes nothing", async () => {
      const uuid = newUuid();
      const res = await http()
        .post(`${API}/mobile/visits/create`)
        .set('Authorization', BEARER)
        .send(visitBody(uuid));
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({
        cvId: expect.any(String),
        cvClientUuid: uuid,
        cvVisitAt: '2026-11-16T05:12:00.000Z',
        duplicate: false,
      });
      const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT cv_device_id::text AS device, cv_branch_id::text AS branch, cv_user_id::text AS "user",
               cv_reason_code AS reason, cv_latitude::text AS lat, cv_longitude::text AS lng,
               cv_gps_accuracy::text AS acc, cv_created_by AS by
          FROM sales.customer_visit WHERE cv_id = ${res.body.data.cvId}::uuid`;
      expect(row).toEqual({
        device: harness.devId,
        branch: harness.devBranchId,
        user: ACTOR,
        reason: 'shopClosed',
        lat: '11.108512',
        lng: '77.341067',
        acc: '12.50',
        by: ACTOR,
      });
      const again = await http()
        .post(`${API}/mobile/visits/create`)
        .set('Authorization', BEARER)
        .send(visitBody(uuid));
      expect(again.status).toBe(201);
      expect(again.body.data).toEqual({ ...res.body.data, duplicate: true });

      const reused = await http()
        .post(`${API}/mobile/visits/create`)
        .set('Authorization', BEARER)
        .send(visitBody(uuid, { cvCustId: otherCustomerId }));
      expect(reused.status).toBe(409);
      expect(reused.body.errors[0].code).toBe('MOBILE_CLIENT_UUID_REUSED');
    }, 60_000);

    it('every reason code saves; a bad one, half a position or an unknown salesman does not', async () => {
      for (const reason of ['noOrder', 'shopBusy', 'ownerAway', 'paymentPending', 'nextVisit']) {
        const res = await http()
          .post(`${API}/mobile/visits/create`)
          .send(
            visitBody(newUuid(), { cvReasonCode: reason, cvLatitude: null, cvLongitude: null }),
          );
        expect(res.status).toBe(201);
      }
      const bad = await http()
        .post(`${API}/mobile/visits/create`)
        .send(visitBody(newUuid(), { cvReasonCode: 'closed' }));
      expect(bad.status).toBe(400);
      expect(bad.body.errors[0].field).toBe('cvReasonCode');

      const half = await http()
        .post(`${API}/mobile/visits/create`)
        .send(visitBody(newUuid(), { cvLongitude: null }));
      expect(half.status).toBe(400);
      expect(half.body.errors[0].code).toBe('MOBILE_VISIT_POSITION_INCOMPLETE');

      const nobody = await http()
        .post(`${API}/mobile/visits/create`)
        .send(visitBody(newUuid(), { cvSalesmanId: randomUUID() }));
      expect(nobody.status).toBe(404);
      expect(nobody.body.errors[0].code).toBe('MOBILE_VISIT_SALESMAN_NOT_FOUND');

      const blocked = await http()
        .post(`${API}/mobile/visits/create`)
        .send(visitBody(newUuid(), { deviceUid: zDeviceUids[0] }));
      expect(blocked.status).toBe(403);
      expect(blocked.body.errors[0].code).toBe('MOBILE_DEVICE_BLOCKED');

      // No token: saved with no user, stamped with the default actor.
      const [anon] = await prisma.$queryRaw<{ user: string | null; by: string }[]>`
        SELECT cv_user_id::text AS "user", cv_created_by AS by FROM sales.customer_visit
         WHERE cv_company_id = ${COMPANY}::uuid AND cv_client_uuid = ${visitUuids[1]}::uuid`;
      expect(anon).toEqual({ user: null, by: '00000000-0000-0000-0000-000000000000' });
    }, 60_000);
  });
});
