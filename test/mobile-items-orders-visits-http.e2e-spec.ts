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
import { WaPostHook, type WaPostEvent } from '../src/modules/whatsapp/hook/wa-post-hook';

/**
 * /mobile/items, /mobile/orders, /mobile/visits over HTTP against the live dev
 * DB (memory erp-server-http-testing-without-credentials): the real guard,
 * house pipe, versioning, prefix and filters; only the token is stubbed.
 *
 * Test-owned data only:
 *  - orders: every order this run creates carries a client uuid made here.
 *    The upload confirms it (user, 2026-11-19), so a CONFIRMED one is
 *    cancelled through POST /sale-orders/cancel (which releases its stock
 *    reservations) and one kept DRAFT is deleted through DELETE
 *    /sale-orders/delete;
 *  - visits: deleted by their client uuids (an insert-only table);
 *  - one blocked / one inactive device row (ZT-MOBILE-*), hard-deleted: no
 *    document can reference a refused phone.
 * The phone is the sales harness device (E2E-SALES-HARNESS, D9), registered to
 * COMPANY's Coimbatore branch.
 *
 * WaPostHook is stubbed (it records what WhatsApp on Post would be asked to
 * send): with the real one, a company that ticks Sales Order in
 * whatsapp.on_post_types would send a real message for every test order.
 */

const API = '/api/v1';
const BEARER = 'Bearer dummy-test-token';
/** A login with no Post right on Sales Order (menu 11): its token is this one. */
const NO_POST_BEARER = 'Bearer dummy-no-post-right-token';
const ACTOR = '019e441b-6e48-7918-b246-b857ffb35db1'; // VKPOS
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const HARNESS_UID = 'E2E-SALES-HARNESS';

const prisma = new PrismaClient();
/** Every WhatsApp on Post the API fired this run. */
const waFired: WaPostEvent[] = [];

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
  /**
   * The godown a blank line of `orderItem` is saved in (user, 2026-11-20): the
   * item's price-row godown for its unit, else the harness branch's live default.
   */
  let orderItemGodownId: string | null = null;
  /** A live login without the menu-11 Post right (null when the DB has none). */
  let noPostUser: { id: string; login: string } | null = null;

  const http = () => request(app.getHttpServer());

  /**
   * The godown a phone line naming none is saved in, read straight from the
   * tables (notes 51 / user 2026-11-20): the headline price row in force today
   * for the item's unit (a branch row before a chain row) gives its
   * ipm_godown_id; a row without one, or no row, gives the harness branch's
   * live default godown.
   */
  async function lineGodownOf(itemId: string, iucId: string): Promise<string | null> {
    const [row] = await prisma.$queryRaw<{ id: string | null }[]>`
      SELECT COALESCE(
               (SELECT p.ipm_godown_id::text FROM inventory.item_price_master p
                 WHERE p.ipm_item_id = ${itemId}::uuid AND p.ipm_uc_unit_id = ${iucId}::uuid
                   AND p.ipm_is_deleted = false
                   AND p.ipm_bucket_mrp IS NULL AND p.ipm_bucket_sp IS NULL
                   AND (p.ipm_branch_id = ${harness.devBranchId}::uuid OR p.ipm_branch_id IS NULL)
                   AND CURRENT_DATE BETWEEN p.ipm_effective_from AND p.ipm_effective_to
                 ORDER BY (p.ipm_branch_id IS NOT NULL) DESC, p.ipm_id LIMIT 1),
               (SELECT g.gdl_id::text FROM public.branch_master b
                  JOIN inventory.godown_locations g ON g.gdl_id = b.br_default_godown_id
                 WHERE b.br_id = ${harness.devBranchId}::uuid AND g.gdl_is_deleted = false)
             ) AS id`;
    return row?.id ?? null;
  }

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
    // Read before the app boots: the token stub answers its claims. The dev
    // salesman logins (raman, ravi) first; only the token is stubbed, so the
    // login itself is never changed.
    const [noPost] = await prisma.$queryRaw<{ id: string; login: string }[]>`
      SELECT u.usr_id::text AS id, u.usr_login_name AS login FROM public.user_master u
       WHERE u.usr_is_deleted = false AND u.usr_is_active = true
         AND NOT EXISTS (SELECT 1 FROM public.user_menus m
                          WHERE m.um_user_id = u.usr_id AND m.um_menu_id = 11
                            AND m.um_is_deleted = false AND m.um_can_post = true)
       ORDER BY u.usr_login_name IN ('raman', 'ravi') DESC, u.usr_login_name LIMIT 1`;
    noPostUser = noPost ?? null;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({
        verifyAccessToken: (token: string): AccessTokenPayload =>
          noPostUser && `Bearer ${token}` === NO_POST_BEARER
            ? { ...claims, sub: noPostUser.id, user_name: noPostUser.login, user_type: 'USER' }
            : claims,
      })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .overrideProvider(WaPostHook)
      .useValue({
        register: (): void => undefined,
        fire: async (event: WaPostEvent): Promise<null> => {
          waFired.push(event);
          return null;
        },
      })
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
    orderItemGodownId = await lineGodownOf(orderItem.itemId, orderItem.iucId);
    await prisma.$executeRaw`
      INSERT INTO fixed.device_master (dev_device_uid, dev_device_name, dev_device_type, dev_is_blocked, dev_block_reason, dev_is_active)
      VALUES (${zDeviceUids[0]}, 'ZT mobile blocked', 'Mobile', true, 'lost phone', true),
             (${zDeviceUids[1]}, 'ZT mobile off', 'Mobile', false, NULL, false)`;
  }, 120_000);

  afterAll(async () => {
    const orders = orderUuids.length
      ? await prisma.$queryRaw<
          {
            soId: string;
            soBranchId: string;
            soAccYear: string;
            soIsDeleted: boolean;
            soStatus: string;
          }[]
        >`
          SELECT so_id AS "soId", so_branch_id AS "soBranchId", so_acc_year::text AS "soAccYear",
                 so_is_deleted AS "soIsDeleted", so_status AS "soStatus"
            FROM sales.sale_order
           WHERE so_company_id = ${COMPANY}::uuid AND so_client_uuid = ANY(${orderUuids}::uuid[])`
      : [];
    for (const o of orders.filter((row) => !row.soIsDeleted && row.soStatus !== 'CANCELLED')) {
      const keys = {
        soId: o.soId,
        soCompanyId: COMPANY,
        soBranchId: o.soBranchId,
        soAccYear: o.soAccYear.trim(),
      };
      if (o.soStatus === 'DRAFT') {
        await http().delete(`${API}/sale-orders/delete`).query(keys).set('Authorization', BEARER);
      } else {
        // VKPOS holds the Cancel right on menu 11; the cancel releases the reservations.
        await http()
          .post(`${API}/sale-orders/cancel`)
          .set('Authorization', BEARER)
          .send({ ...keys, reason: `ZT-MOBILE-ORDER ${stamp} teardown` });
      }
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
    it('options: live companies and their branches, groups, brands; price levels without Cost', async () => {
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

      // branches: the active, live branches of exactly the listed companies, per company in
      // their order, then by name and id (the /master-lookups/branches/by-company rows).
      const expected = await prisma.$queryRaw<
        { id: string; name: string; companyId: string; isDefault: boolean }[]
      >`
        SELECT b.br_id::text AS id, b.br_name AS name, b.br_comp_id::text AS "companyId",
               b.br_is_default IS TRUE AS "isDefault"
          FROM public.branch_master b
          JOIN public.companys c ON c.comp_id = b.br_comp_id
         WHERE b.br_is_active = true AND b.br_is_deleted = false
           AND c.comp_is_deleted = false AND c.comp_is_active = true
         ORDER BY c.comp_name, c.comp_id, b.br_name, b.br_id`;
      expect(d.branches).toEqual(expected);
      const listed = new Set(d.companies.map((c: { id: string }) => c.id));
      expect(d.branches.every((b: { companyId: string }) => listed.has(b.companyId))).toBe(true);
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

    it('list: categoryId / sectionId are item_master.item_category_id / item_section_id', async () => {
      const res = await http()
        .get(`${API}/mobile/items/list`)
        .query({ companyId: COMPANY, deviceUid: HARNESS_UID, pageSize: 500 });
      expect(res.status).toBe(200);
      const items = res.body.data.items as Array<
        MobileItem & { categoryId: string | null; sectionId: string | null }
      >;
      const ids = items.map((i) => i.itemId);
      const rows = await prisma.$queryRaw<
        { id: string; categoryId: string | null; sectionId: string | null }[]
      >`
        SELECT item_id::text AS id, item_category_id::text AS "categoryId",
               item_section_id::text AS "sectionId"
          FROM inventory.item_master WHERE item_id = ANY(${ids}::uuid[])`;
      const byId = new Map(rows.map((r) => [r.id, r] as const));
      for (const item of items) {
        expect('categoryId' in item && 'sectionId' in item).toBe(true);
        expect([item.categoryId, item.sectionId]).toEqual([
          byId.get(item.itemId)!.categoryId,
          byId.get(item.itemId)!.sectionId,
        ]);
      }
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
    const statusOf = async (soId: string): Promise<string> => {
      const [row] = await prisma.$queryRaw<{ status: string }[]>`
        SELECT so_status AS status FROM sales.sale_order WHERE so_id = ${soId}::uuid`;
      return row.status;
    };
    const trailOf = (soId: string) =>
      prisma.$queryRaw<{ event: string; to: string; by: string; remarks: string | null }[]>`
        SELECT tsl_event AS event, tsl_to_status AS "to", tsl_changed_by::text AS by,
               tsl_remarks AS remarks
          FROM public.txn_status_log WHERE tsl_src_doc_id = ${soId}::uuid ORDER BY tsl_seq_no`;

    it('saves and confirms, with the server-filled device, branch, year, number and the login user', async () => {
      const uuid = newUuid();
      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(uuid));
      expect(res.status).toBe(201);
      const d = res.body.data;
      expect(d).toEqual(
        expect.objectContaining({
          soStatus: 'CONFIRMED',
          duplicate: false,
          soIsDeleted: false,
          confirmRefused: null,
        }),
      );
      // The line named no godown: it is saved in its item's godown (else the
      // branch default), so no "no godown" warning; a shortfall of stock there
      // is still a warning, never a refusal.
      const [line] = await prisma.$queryRaw<{ godown: string | null }[]>`
        SELECT soi_godown_id::text AS godown FROM sales.sale_order_item
         WHERE soi_order_id = ${d.soId}::uuid AND soi_is_deleted = false`;
      expect(line.godown).toBe(orderItemGodownId);
      for (const w of d.warnings as { code: string; message: string }[]) {
        expect(w.code).toBe('SALES_RESERVE_SHORT');
        if (orderItemGodownId) expect(w.message).not.toContain('no godown');
      }
      // WhatsApp on Post was asked for this order, after the commit, with the company's say.
      expect(waFired).toContainEqual({
        docType: 'SALES_ORDER',
        docId: d.soId,
        accYear: d.soAccYear,
        companyId: COMPANY,
        branchId: harness.devBranchId,
        vchrTypeId: 4,
        waOnPost: null,
      });
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
      expect(await statusOf(d.soId)).toBe('CONFIRMED');
      expect(await trailOf(d.soId)).toEqual([
        { event: 'CREATED', to: 'DRAFT', by: ACTOR, remarks: null },
        {
          event: 'POSTED',
          to: 'CONFIRMED',
          by: ACTOR,
          remarks: expect.stringMatching(/^Confirmed from the phone/),
        },
      ]);
      const [audit] = await prisma.$queryRaw<{ notes: string }[]>`
        SELECT log_notes AS notes FROM audit.audit_log
         WHERE log_pk = ${d.soId} AND log_action = 'approve'`;
      expect(audit.notes).toBe('Order confirmed from the phone');
    }, 60_000);

    it('saves a phone line with what the desktop order screen sends beside it (user, 2026-11-20)', async () => {
      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(
          orderBody(newUuid(), {
            items: [
              {
                soiItemId: orderItem.itemId,
                soiItemUnitId: orderItem.iucId,
                soiPriceLevel: 1,
                soiOrderQty: 2,
                soiNetQty: 2,
                soiRate: 10,
                soiIsTaxIncl: false,
                soiTaxPerc: 0,
                soiTaxAmt: 0,
                soiGrossAmt: 20,
                soiTaxableAmt: 20,
                soiNetAmt: 20,
              },
            ],
          }),
        );
      expect(res.status).toBe(201);
      const soId = res.body.data.soId as string;
      const [line] = await prisma.$queryRaw<
        {
          godown: string | null;
          locked: boolean;
          act: string | null;
          cost: string | null;
          costPreTax: string | null;
          mrp: string;
          preTax: string;
          netGross: string | null;
          sold: string | null;
          profit: string | null;
          savings: string | null;
        }[]
      >`
        SELECT soi_godown_id::text AS godown, soi_is_rate_locked AS locked,
               soi_act_price::text AS act, soi_cost_price::text AS cost,
               soi_cost_pre_tax::text AS "costPreTax", soi_max_price::text AS mrp,
               soi_rate_pre_tax::text AS "preTax", soi_net_gross::text AS "netGross",
               soi_sold_price::text AS sold, soi_item_profit::text AS profit,
               soi_mrp_savings::text AS savings
          FROM sales.sale_order_item
         WHERE soi_order_id = ${soId}::uuid AND soi_is_deleted = false`;
      // What the desktop's pick reads for that line.
      const lookup = await http()
        .get(`${API}/master-lookups/item-price`)
        .query({
          item_id: orderItem.itemId,
          unit_id: orderItem.iucId,
          company_id: COMPANY,
          branch_id: harness.devBranchId,
          customer_id: customerId,
          price_level: 1,
          ...(line.godown ? { godown_id: line.godown } : {}),
        })
        .set('Authorization', BEARER);
      expect(lookup.status).toBe(200);
      const facts = lookup.body.data;
      const d = (v: string | number | null) => new Prisma.Decimal(v ?? 0);
      expect(line.locked).toBe(false);
      expect(d(line.act).toFixed(2)).toBe(d(facts.sales_price).toFixed(2));
      expect(d(line.cost).toFixed(2)).toBe(d(facts.cost_price).toFixed(2));
      expect(d(line.costPreTax).toFixed(2)).toBe(d(facts.cost_wot).toFixed(2));
      expect(d(line.preTax).toFixed(2)).toBe('10.00');
      expect(d(line.netGross).toFixed(2)).toBe('20.00');
      expect(d(line.sold).toFixed(2)).toBe('10.00');
      expect(d(line.profit).toFixed(2)).toBe(d(10).minus(d(facts.cost_price)).toFixed(2));
      const mrp = d(facts.max_price);
      expect(d(line.savings).toFixed(2)).toBe((mrp.gt(0) ? mrp.minus(10).mul(2) : d(0)).toFixed(2));
      const [head] = await prisma.$queryRaw<
        { totalCost: string | null; custStcd: string | null; wantStcd: string | null }[]
      >`
        SELECT so.so_total_cost::text AS "totalCost", so.so_cust_stcd AS "custStcd",
               NULLIF(TRIM(c.cus_state_code), '') AS "wantStcd"
          FROM sales.sale_order so JOIN sales.customers c ON c.cus_id = so.so_cust_id
         WHERE so.so_id = ${soId}::uuid`;
      expect(d(head.totalCost).toFixed(2)).toBe(d(facts.cost_price).mul(2).toFixed(2));
      expect(head.custStcd).toBe(head.wantStcd);
    }, 60_000);

    it('reserves the stock of a line that names a godown, as the office Confirm does', async () => {
      // A free SALEABLE holding of an orderable item at the phone's branch.
      const [held] = await prisma.$queryRaw<{ itemId: string; godownId: string; unitId: string }[]>`
        SELECT b.sbl_item_id::text AS "itemId", b.sbl_godown_id::text AS "godownId",
               (SELECT u.iuc_id::text FROM inventory.item_unit_conversion u
                 WHERE u.iuc_item_id = b.sbl_item_id AND u.iuc_is_deleted = false
                   AND u.iuc_is_active = true
                 ORDER BY u.iuc_is_base_unit DESC, u.iuc_id LIMIT 1) AS "unitId"
          FROM stock.stock_balance b
          JOIN inventory.item_master i ON i.item_id = b.sbl_item_id
         WHERE b.sbl_company_id = ${COMPANY}::uuid AND b.sbl_branch_id = ${harness.devBranchId}::uuid
           AND b.sbl_is_deleted = false AND b.sbl_bucket = 'SALEABLE' AND b.sbl_godown_id IS NOT NULL
           AND i.item_allow_so AND i.item_is_active AND NOT i.item_is_deleted
           AND i.item_name_en NOT ILIKE 'ZT%' AND i.item_name_en NOT ILIKE 'E2E%'
         GROUP BY b.sbl_item_id, b.sbl_godown_id
        HAVING SUM(b.sbl_available_qty) >= 5
         ORDER BY b.sbl_item_id LIMIT 1`;
      if (!held?.unitId) {
        // eslint-disable-next-line no-console
        console.warn('no free stock with a godown at the harness branch: reservation not checked');
        return;
      }
      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(
          orderBody(newUuid(), {
            items: [
              {
                soiItemId: held.itemId,
                soiItemUnitId: held.unitId,
                soiGodownId: held.godownId,
                soiOrderQty: 1,
                soiNetQty: 1,
                soiRate: 10,
                soiNetAmt: 10,
              },
            ],
          }),
        );
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(
        expect.objectContaining({ soStatus: 'CONFIRMED', confirmRefused: null, warnings: [] }),
      );
      const reservations = await prisma.$queryRaw<{ line: number; open: string; status: string }[]>`
        SELECT srv_line_no AS line, srv_open_qty::text AS open, srv_status AS status
          FROM stock.stock_reservation WHERE srv_src_doc_id = ${res.body.data.soId}::uuid`;
      expect(reservations.length).toBeGreaterThan(0);
      expect(reservations.every((r) => r.line === 1 && r.status === 'OPEN')).toBe(true);
      const [line] = await prisma.$queryRaw<{ reserved: boolean }[]>`
        SELECT soi_is_reserved AS reserved FROM sales.sale_order_item
         WHERE soi_order_id = ${res.body.data.soId}::uuid AND soi_is_deleted = false`;
      expect(line.reserved).toBe(true);
    }, 60_000);

    it("reserves a line with no godown in its item's godown, with no warning (user, 2026-11-20)", async () => {
      // Items with free stock in a godown of the harness branch; the first
      // whose own rule (lineGodownOf) lands on that godown is ordered blank.
      const candidates = await prisma.$queryRaw<
        { itemId: string; unitId: string | null; godownId: string }[]
      >`
        SELECT b.sbl_item_id::text AS "itemId", b.sbl_godown_id::text AS "godownId",
               (SELECT u.iuc_id::text FROM inventory.item_unit_conversion u
                 WHERE u.iuc_item_id = b.sbl_item_id AND u.iuc_is_deleted = false
                   AND u.iuc_is_active = true
                 ORDER BY u.iuc_is_base_unit DESC, u.iuc_id LIMIT 1) AS "unitId"
          FROM stock.stock_balance b
          JOIN inventory.item_master i ON i.item_id = b.sbl_item_id
         WHERE b.sbl_company_id = ${COMPANY}::uuid AND b.sbl_branch_id = ${harness.devBranchId}::uuid
           AND b.sbl_godown_id IS NOT NULL
           AND b.sbl_is_deleted = false AND b.sbl_bucket = 'SALEABLE'
           AND i.item_allow_so AND i.item_is_active AND NOT i.item_is_deleted
           AND i.item_name_en NOT ILIKE 'ZT%' AND i.item_name_en NOT ILIKE 'E2E%'
         GROUP BY b.sbl_item_id, b.sbl_godown_id
        HAVING SUM(b.sbl_available_qty) >= 5
         ORDER BY b.sbl_item_id, b.sbl_godown_id LIMIT 200`;
      let held: { itemId: string; unitId: string; godownId: string } | null = null;
      for (const c of candidates) {
        if (c.unitId && (await lineGodownOf(c.itemId, c.unitId)) === c.godownId) {
          held = { itemId: c.itemId, unitId: c.unitId, godownId: c.godownId };
          break;
        }
      }
      if (!held?.unitId) {
        // eslint-disable-next-line no-console
        console.warn("no free stock in an item's own godown: reservation not checked");
        return;
      }
      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(
          orderBody(newUuid(), {
            items: [
              {
                soiItemId: held.itemId,
                soiItemUnitId: held.unitId,
                soiOrderQty: 1,
                soiNetQty: 1,
                soiRate: 10,
                soiNetAmt: 10,
              },
            ],
          }),
        );
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(
        expect.objectContaining({ soStatus: 'CONFIRMED', confirmRefused: null, warnings: [] }),
      );
      const reservations = await prisma.$queryRaw<{ godown: string; status: string }[]>`
        SELECT srv_godown_id::text AS godown, srv_status AS status
          FROM stock.stock_reservation WHERE srv_src_doc_id = ${res.body.data.soId}::uuid`;
      expect(reservations.length).toBeGreaterThan(0);
      expect(reservations.every((r) => r.godown === held.godownId && r.status === 'OPEN')).toBe(
        true,
      );
    }, 60_000);

    it('a login without the menu-11 Post right still gets its order confirmed (user, 2026-11-19)', async () => {
      if (!noPostUser) {
        // eslint-disable-next-line no-console
        console.warn('every live login holds the Post right on menu 11: not checked');
        return;
      }
      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', NO_POST_BEARER)
        .send(orderBody(newUuid()));
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(
        expect.objectContaining({ soStatus: 'CONFIRMED', confirmRefused: null }),
      );
      const trail = await trailOf(res.body.data.soId);
      expect(trail[1]).toEqual(
        expect.objectContaining({ event: 'POSTED', to: 'CONFIRMED', by: noPostUser.id }),
      );

      // The desktop /sale-orders/post still refuses that login.
      const draft = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(newUuid(), { soSalesmanId: [randomUUID()] }));
      expect(draft.body.data.soStatus).toBe('DRAFT');
      const [keys] = await prisma.$queryRaw<{ soBranchId: string }[]>`
        SELECT so_branch_id::text AS "soBranchId" FROM sales.sale_order
         WHERE so_id = ${draft.body.data.soId}::uuid`;
      const desk = await http()
        .post(`${API}/sale-orders/post`)
        .set('Authorization', NO_POST_BEARER)
        .send({
          soId: draft.body.data.soId,
          soCompanyId: COMPANY,
          soBranchId: keys.soBranchId,
          soAccYear: draft.body.data.soAccYear,
        });
      expect(desk.status).toBe(403);
      expect(desk.body.errors[0].code).toBe('SALES_RIGHT_POST');
    }, 60_000);

    it('a refused confirm keeps the DRAFT, says why, and the upload succeeds', async () => {
      const res = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(newUuid(), { soSalesmanId: [randomUUID()] }));
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Order created successfully');
      const d = res.body.data;
      expect(d).toEqual(
        expect.objectContaining({
          soStatus: 'DRAFT',
          duplicate: false,
          warnings: [],
          confirmRefused: expect.objectContaining({
            code: 'SALES_SALESMAN_INVALID',
            field: 'soSalesmanId',
            message: expect.any(String),
          }),
        }),
      );
      // The savepoint undid only the confirm: the draft, its uuid and its CREATED step stand.
      expect(await statusOf(d.soId)).toBe('DRAFT');
      expect((await trailOf(d.soId)).map((t) => t.event)).toEqual(['CREATED']);
      expect(waFired.some((e) => e.docId === d.soId)).toBe(false);
      const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM stock.stock_reservation WHERE srv_src_doc_id = ${d.soId}::uuid`;
      expect(n).toBe(0);
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
      // A resend writes nothing and does not confirm again: no warnings of its own.
      expect(again.body.data).toEqual({
        ...first.body.data,
        duplicate: true,
        confirmRefused: null,
        warnings: [],
      });
      expect(again.body.message).toBe('Order already saved');
      expect(waFired.filter((e) => e.docId === first.body.data.soId)).toHaveLength(1);

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
      const savedCount = async (): Promise<number> => {
        const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM sales.sale_order
           WHERE so_company_id = ${COMPANY}::uuid AND so_remarks = ${`ZT-MOBILE-ORDER ${stamp}`}`;
        return n;
      };
      const before = await savedCount();
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
      const year = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(newUuid(), { soAccYear: '2026-2027' }));
      expect(year.status).toBe(400);
      expect(year.body.errors[0].code).toBe('VALIDATION_WHITELIST');

      const empty = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(newUuid(), { items: [] }));
      expect(empty.status).toBe(400);
      expect(empty.body.errors[0].field).toBe('items');

      expect(await savedCount()).toBe(before); // nothing from the refusals
    }, 60_000);

    it('saves in the picked soBranchId, refuses a branch of another company, a resend keeps its branch', async () => {
      // Another live, active branch of COMPANY than the phone's own (not a test suite's).
      const [picked] = await prisma.$queryRaw<{ brId: string }[]>`
        SELECT br_id AS "brId" FROM public.branch_master
         WHERE br_comp_id = ${COMPANY}::uuid AND br_is_deleted = false AND br_is_active = true
           AND br_id <> ${harness.devBranchId}::uuid
           AND br_name NOT ILIKE 'E2E%' AND br_name NOT ILIKE 'ZT%'
         ORDER BY br_name LIMIT 1`;
      const [foreign] = await prisma.$queryRaw<{ brId: string }[]>`
        SELECT br_id AS "brId" FROM public.branch_master
         WHERE br_comp_id <> ${COMPANY}::uuid AND br_is_deleted = false AND br_is_active = true
         ORDER BY br_name LIMIT 1`;
      const branchOf = async (soId: string): Promise<string> => {
        const [row] = await prisma.$queryRaw<{ branch: string }[]>`
          SELECT so_branch_id::text AS branch FROM sales.sale_order WHERE so_id = ${soId}::uuid`;
        return row.branch;
      };

      const uuid = newUuid();
      const saved = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(uuid, { soBranchId: picked.brId }));
      expect(saved.status).toBe(201);
      expect(await branchOf(saved.body.data.soId)).toBe(picked.brId);

      const refused = await http()
        .post(`${API}/mobile/orders/create`)
        .set('Authorization', BEARER)
        .send(orderBody(newUuid(), { soBranchId: foreign.brId }));
      expect(refused.status).toBe(422);
      expect(refused.body.errors[0]).toEqual(
        expect.objectContaining({ field: 'soBranchId', code: 'MOBILE_BRANCH_NOT_OF_COMPANY' }),
      );

      for (const soBranchId of [harness.devBranchId, foreign.brId]) {
        const again = await http()
          .post(`${API}/mobile/orders/create`)
          .set('Authorization', BEARER)
          .send(orderBody(uuid, { soBranchId }));
        expect(again.status).toBe(201);
        expect(again.body.data).toEqual({ ...saved.body.data, duplicate: true, warnings: [] });
      }
      expect(await branchOf(saved.body.data.soId)).toBe(picked.brId);
    }, 60_000);

    it('without a token: soUserId is required, then it is the order user, and the order is confirmed', async () => {
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
      // No login: confirmed all the same, in the default actor's name (as the create stamps it).
      expect(res.body.data).toEqual(
        expect.objectContaining({ soStatus: 'CONFIRMED', confirmRefused: null }),
      );
      expect((await trailOf(res.body.data.soId))[1]).toEqual(
        expect.objectContaining({ event: 'POSTED', by: '00000000-0000-0000-0000-000000000000' }),
      );
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
