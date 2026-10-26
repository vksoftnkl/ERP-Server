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
import {
  grantMenuRights,
  restoreMenuRights,
  type MenuRightsMemo,
  STOCK_TRANSFER_MENU,
} from './helpers/menu-rights';

/**
 * Notes 153 (2026-10-26) — Godown Transfer: the Loading / Unloading boxes, the
 * default rates, and the charges posting to accounts. HTTP-level, live DB, auth
 * stubbed at the provider (memory erp-server-http-testing-without-credentials).
 *
 * One godown transfer of 2 of a lot that has stock, Coimbatore → another godown
 * of the same branch: saved with a crew and rates, refused at despatch while
 * LOADING_PAYABLE maps to nothing, despatched, then cancelled — the stock comes
 * back, the charges voucher gets its reversal, and the list keeps the figures.
 * The holding is read from the balance, never hard-coded; the transfer is the
 * only document it leaves (CANCELLED), and the one ledger map row it touches is
 * put back in `finally`.
 *
 * Run with --runInBand: the menu-41 grant is a shared row.
 */

const T = '/api/v1/stock/transfer';
const BEARER = 'Bearer dummy-test-token';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1
const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  accYear: '2026-2027',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const ADJUSTMENT_MENU = 264;

const prisma = new PrismaClient();
let menuRights: MenuRightsMemo | null = null;

/** Today on the shop's clock — the doc date a live screen sends. */
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

interface Holding {
  godown_id: string;
  item_id: string;
  lot_id: string;
  base_uom_id: string;
  allow_loading: boolean;
  unit_loading: string | null;
  unit_unloading: string | null;
  batch_no: string | null;
  expiry_date: string | null;
  mrp: string | null;
  serial_no: string | null;
}

describe('Godown Transfer loading / unloading — notes 153 (e2e, live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let holding: Holding;
  let toGodownId: string;
  let crew: string[];
  let stranger: string;
  let otherBranchId: string;
  /** srm_code → srm_id of the shared reasons this suite cites. */
  let reasonIds: Record<string, string>;
  let svhId: string | undefined;
  let posted = false;

  /** The document, as a GET / DELETE query names it. */
  const key = () => ({
    svhId: svhId as string,
    accYear: SCOPE.accYear,
    companyId: SCOPE.companyId,
    branchId: SCOPE.branchId,
  });
  /** …and as a despatch / cancel body does. */
  const ref = () => ({ ...key(), userId: ACTOR });
  const line = (over: Record<string, unknown> = {}) => ({
    lineNo: 1,
    itemId: holding.item_id,
    uomId: holding.base_uom_id,
    baseUomId: holding.base_uom_id,
    toBaseFactor: 1,
    godownId: holding.godown_id,
    lotId: holding.lot_id,
    bucket: 'SALEABLE',
    // 2 + 1 free: the labour is paid on the 3 carried.
    qty: 2,
    baseQty: 2,
    freeQty: 1,
    freeBaseQty: 1,
    loadRate: 3.5,
    unloadRate: 1.25,
    ...over,
  });
  const body = (header: Record<string, unknown> = {}, lines?: unknown[]) => ({
    header: {
      accYear: SCOPE.accYear,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      deviceId: SCOPE.deviceId,
      docDate: today(),
      fromGodownId: holding.godown_id,
      toGodownId,
      remarks: 'E2E notes 153 — loading charges',
      ...header,
    },
    lines: lines ?? [line()],
  });
  const codes = (res: request.Response): string[] =>
    ((res.body?.errors ?? []) as Array<{ code: string }>).map((error) => error.code);

  beforeAll(async () => {
    menuRights = await grantMenuRights(prisma, [STOCK_TRANSFER_MENU, ADJUSTMENT_MENU]);
    const [found] = await prisma.$queryRaw<Holding[]>`
      SELECT b.sbl_godown_id AS godown_id, b.sbl_item_id AS item_id, b.sbl_lot_id AS lot_id,
             b.sbl_base_uom_id AS base_uom_id, i.item_allow_loading AS allow_loading,
             u.unit_loading::text AS unit_loading, u.unit_unloading::text AS unit_unloading,
             l.slt_batch_no AS batch_no, to_char(l.slt_expiry_date, 'YYYY-MM-DD') AS expiry_date,
             l.slt_mrp::text AS mrp, l.slt_serial_no AS serial_no
        FROM stock.stock_balance b
        JOIN stock.stock_lot l ON l.slt_id = b.sbl_lot_id
        JOIN inventory.item_master i ON i.item_id = b.sbl_item_id
        JOIN inventory.item_unit_conversion c ON c.iuc_id = b.sbl_base_uom_id
        JOIN inventory.item_unit_master u ON u.unit_id = c.iuc_unit_id
       WHERE b.sbl_company_id = ${SCOPE.companyId}::uuid
         AND b.sbl_branch_id  = ${SCOPE.branchId}::uuid
         AND b.sbl_bucket = 'SALEABLE' AND b.sbl_is_deleted = false
         AND b.sbl_available_qty >= 5
         AND i.item_is_active AND NOT i.item_is_deleted
         AND c.iuc_to_base_factor = 1
       ORDER BY i.item_allow_loading DESC, b.sbl_available_qty DESC
       LIMIT 1`;
    if (!found) {
      throw new Error('No holding with 5+ available in the test branch — seed one first');
    }
    holding = found;
    const [other] = await prisma.$queryRaw<{ gdl_id: string }[]>`
      SELECT gdl_id FROM inventory.godown_locations
       WHERE gdl_branch_id = ${SCOPE.branchId}::uuid AND gdl_id <> ${holding.godown_id}::uuid
       ORDER BY gdl_name LIMIT 1`;
    toGodownId = other.gdl_id;
    crew = (
      await prisma.$queryRaw<{ emp_id: string }[]>`
        SELECT emp_id FROM public.employee_master
         WHERE emp_company_id = ${SCOPE.companyId}::uuid AND emp_is_deleted = false
         ORDER BY emp_id LIMIT 2`
    ).map((row) => row.emp_id);
    const [notMine] = await prisma.$queryRaw<{ emp_id: string }[]>`
      SELECT emp_id FROM public.employee_master
       WHERE emp_company_id IS DISTINCT FROM ${SCOPE.companyId}::uuid AND emp_is_deleted = false
       LIMIT 1`;
    stranger = notMine?.emp_id ?? '01000000-0000-7000-8000-00000000dead';
    const [branch] = await prisma.$queryRaw<{ br_id: string }[]>`
      SELECT br_id FROM public.branch_master
       WHERE br_comp_id = ${SCOPE.companyId}::uuid AND br_id <> ${SCOPE.branchId}::uuid LIMIT 1`;
    otherBranchId = branch.br_id;
    reasonIds = Object.fromEntries(
      (
        await prisma.$queryRaw<{ srm_code: string; srm_id: string }[]>`
          SELECT srm_code, srm_id FROM stock.stock_reason_master
           WHERE srm_company_id IS NULL AND srm_is_deleted = false
             AND srm_code IN ('REPLENISH', 'TRANSIT_LOSS')`
      ).map((row) => [row.srm_code, row.srm_id]),
    );

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-notes-153',
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
  }, 120_000);

  afterAll(async () => {
    await restoreMenuRights(prisma, menuRights);
    // Whatever a failed case left: a posted transfer is cancelled (the stock
    // comes back), a draft deleted.
    if (svhId && http) {
      if (posted) {
        await http
          .post(`${T}/cancel`)
          .set('Authorization', BEARER)
          .send({ ...ref(), reason: 'E2E notes 153 teardown' });
      } else {
        await http.delete(T).set('Authorization', BEARER).query(key());
      }
    }
    await app?.close();
    await prisma.$disconnect();
  });

  // ── C — the default rates ─────────────────────────────────────────────────
  it("C: item-lookup and pick-stock answer the unit's rates when the item pays loading, else 0", async () => {
    const expected = (value: string | null) => (holding.allow_loading ? Number(value ?? 0) : 0);

    const lookup = await http.get('/api/v1/stock/opening/item-lookup').set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      itemId: holding.item_id,
      uomId: holding.base_uom_id,
      onDate: today(),
    });
    expect(lookup.status).toBe(200);
    expect(lookup.body.data).toMatchObject({
      loadRate: expected(holding.unit_loading),
      unloadRate: expected(holding.unit_unloading),
    });

    const pick = await http.get('/api/v1/stock/adjustment/pick-stock').set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      godownId: holding.godown_id,
      itemId: holding.item_id,
    });
    expect(pick.status).toBe(200);
    const row = (pick.body.data as Array<{ lotId: string; loadRate: number; unloadRate: number }>).find(
      (r) => r.lotId === holding.lot_id,
    );
    expect(row).toMatchObject({
      loadRate: expected(holding.unit_loading),
      unloadRate: expected(holding.unit_unloading),
    });
  });

  // ── B — the refusals ──────────────────────────────────────────────────────
  it('B: 422 per field — a negative rate, a stranger in the crew, a load time before the doc date', async () => {
    const negative = await http.post(T).set('Authorization', BEARER).send(body({}, [line({ loadRate: -1 })]));
    expect(negative.status).toBe(422);
    expect(negative.body.errors).toEqual([
      expect.objectContaining({ field: 'lines.0.loadRate', code: 'STOCK_LOADING_RATE_NEGATIVE' }),
    ]);

    const outsider = await http.post(T).set('Authorization', BEARER).send(body({ driverId: stranger }));
    expect(outsider.status).toBe(422);
    expect(outsider.body.errors).toEqual([
      expect.objectContaining({ field: 'driverId', code: 'STOCK_LOADING_EMPLOYEE_INVALID' }),
    ]);

    const early = await http
      .post(T)
      .set('Authorization', BEARER)
      .send(body({ loadEnabled: true, loadDatetime: `${today()}T00:00:00+05:30`, unloadDatetime: '2026-04-01T08:00:00+05:30' }));
    expect(early.status).toBe(422);
    expect(early.body.errors).toEqual([
      expect.objectContaining({ field: 'unloadDatetime', code: 'STOCK_LOADING_BEFORE_DOC_DATE' }),
    ]);
  });

  it('B: other stock types refuse the fields — 400 at the boundary on opening and adjustment', async () => {
    const opening = await http
      .post('/api/v1/stock/opening/create')
      .set('Authorization', BEARER)
      .send({ header: { ...body().header, loadEnabled: true }, lines: [] });
    expect(opening.status).toBe(400);
    expect(JSON.stringify(opening.body)).toContain('loadEnabled');

    const adjustment = await http
      .post('/api/v1/stock/adjustment')
      .set('Authorization', BEARER)
      .send({ header: { ...body().header, voucherType: 'ADJUSTMENT', loadmanIds: crew }, lines: [] });
    expect(adjustment.status).toBe(400);
    expect(JSON.stringify(adjustment.body)).toContain('loadmanIds');
  });

  it('E4: the picker offers the three transfer reasons and not TRANSIT_LOSS; the save refuses TRANSIT_LOSS', async () => {
    const picker = await http
      .get('/api/v1/stock/reasons')
      .set('Authorization', BEARER)
      .query({ companyId: SCOPE.companyId, voucherType: 'TRANSFER_OUT' });
    expect(picker.status).toBe(200);
    const pickedCodes = (picker.body.data as Array<{ code: string }>).map((row) => row.code);
    expect(pickedCodes).toEqual(expect.arrayContaining(['REPLENISH', 'REARRANGE', 'RETURN_STORE']));
    expect(pickedCodes).not.toContain('TRANSIT_LOSS');

    const loss = await http
      .post(T)
      .set('Authorization', BEARER)
      .send(body({ reasonId: reasonIds.TRANSIT_LOSS }));
    expect(loss.status).toBe(422);
    expect(loss.body.errors).toEqual([
      expect.objectContaining({ field: 'reasonId', code: 'STOCK_REASON_WRONG_DIRECTION' }),
    ]);
  });

  it('B: a branch despatch refuses its unloading box — the receipt records that (notes 156: its loading charge stands)', async () => {
    const res = await http
      .post(T)
      .set('Authorization', BEARER)
      .send(body({ toBranchId: otherBranchId, loadEnabled: true, unloadmanIds: crew.slice(0, 1) }));
    expect(res.status).toBe(422);
    expect(codes(res)).toEqual(['STOCK_LOADING_WRONG_HALF']);
  });

  // ── A + B — the save, and what the GET returns ────────────────────────────
  it('A/B: saves the crew and rates; the server sums each charge and the GET names the crew', async () => {
    const res = await http
      .post(T)
      .set('Authorization', BEARER)
      .send(
        body({
          loadEnabled: true,
          loadDatetime: new Date().toISOString(),
          loadmanIds: crew,
          driverId: crew[0],
          supervisorId: crew[1] ?? crew[0],
          vehicleNo: 'TN 28 E2E 153',
          unloadEnabled: true,
          unloadmanIds: crew.slice(0, 1),
          unloadSupervisorId: crew[0],
          reasonId: reasonIds.REPLENISH,
        }),
      );
    expect(res.status).toBe(201);
    svhId = res.body.data.header.svhId;

    const got = await http.get(T).set('Authorization', BEARER).query(key());
    expect(got.status).toBe(200);
    const names = await prisma.$queryRaw<{ emp_id: string; emp_name: string }[]>`
      SELECT emp_id, emp_name FROM public.employee_master WHERE emp_id = ANY(${crew}::uuid[])`;
    const nameOf = new Map(names.map((row) => [row.emp_id, row.emp_name]));
    expect(got.body.data.header).toMatchObject({
      status: 'DRAFT',
      loadEnabled: true,
      loadmanIds: crew,
      loadmanNames: crew.map((id) => nameOf.get(id)),
      driverId: crew[0],
      driverName: nameOf.get(crew[0]),
      vehicleNo: 'TN 28 E2E 153',
      reasonId: reasonIds.REPLENISH,
      // (2 + 1 free) × 3.5 and × 1.25, summed by the server.
      loadingCharge: 10.5,
      unloadEnabled: true,
      unloadmanNames: [nameOf.get(crew[0])],
      unloadSupervisorName: nameOf.get(crew[0]),
      unloadingCharge: 3.75,
    });
    // E5 — the line names a lot and keys no identity: the GET reads the lot's.
    expect(got.body.data.lines[0]).toMatchObject({
      loadRate: 3.5,
      unloadRate: 1.25,
      batchNo: holding.batch_no,
      expiryDate: holding.expiry_date,
      mrp: holding.mrp === null ? null : Number(holding.mrp),
      serialNo: holding.serial_no,
    });
  });

  // ── D — the charges post ──────────────────────────────────────────────────
  it('D: an unmapped LOADING_PAYABLE refuses the despatch with a 422 naming Ledger Map; nothing moves', async () => {
    const rows = await prisma.$queryRaw<{ alm_id: string }[]>`
      UPDATE accounts.acc_ledger_map SET alm_is_active = false
       WHERE alm_role = 'LOADING_PAYABLE' AND alm_is_deleted = false AND alm_is_active = true
      RETURNING alm_id`;
    try {
      const res = await http.post(`${T}/despatch`).set('Authorization', BEARER).send(ref());
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual([
        expect.objectContaining({
          code: 'STOCK_LOADING_ROLE_UNMAPPED',
          message: expect.stringContaining('Ledger Map'),
        }),
      ]);
      const [doc] = await prisma.$queryRaw<{ svh_status: string }[]>`
        SELECT svh_status FROM stock.stock_voucher WHERE svh_id = ${svhId}::uuid`;
      expect(doc.svh_status).toBe('DRAFT');
    } finally {
      for (const { alm_id } of rows) {
        await prisma.$executeRaw`UPDATE accounts.acc_ledger_map SET alm_is_active = true WHERE alm_id = ${alm_id}::uuid`;
      }
    }
  });

  it('D: despatch posts ONE TRF voucher, DR Loading & unloading charges / CR Loading charges payable, 14.25', async () => {
    const res = await http.post(`${T}/despatch`).set('Authorization', BEARER).send(ref());
    // A Nest POST answers 201 unless the route says otherwise; these do not.
    expect(res.status).toBe(201);
    posted = true;
    expect(res.body.data).toMatchObject({ sameBranch: true, status: 'POSTED' });

    const vouchers = await prisma.$queryRaw<
      { avh_voucher_id: string; vchr_type_code: string; avh_voucher_status: string }[]
    >`
      SELECT h.avh_voucher_id, t.vchr_type_code, h.avh_voucher_status
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       WHERE h.avh_src_module = 'STOCK' AND h.avh_src_doc_type = 'TRANSFER_OUT'
         AND h.avh_src_doc_id = ${svhId}::uuid AND h.avh_is_deleted = false`;
    expect(vouchers).toEqual([expect.objectContaining({ vchr_type_code: 'TRF', avh_voucher_status: 'POSTED' })]);
    const legs = await prisma.$queryRaw<{ av_role: string; av_dr_cr: string; av_amount: string }[]>`
      SELECT av_role, av_dr_cr, av_amount::text AS av_amount FROM accounts.acc_vouchers
       WHERE av_voucher_id = ${vouchers[0].avh_voucher_id}::uuid AND av_is_deleted = false
       ORDER BY av_dr_cr DESC`;
    expect(legs).toEqual([
      { av_role: 'LOADING_CHARGES', av_dr_cr: 'DR', av_amount: '14.25' },
      { av_role: 'LOADING_PAYABLE', av_dr_cr: 'CR', av_amount: '14.25' },
    ]);
  });

  it('D + E1: cancel reverses the charges voucher; the list keeps the moved figures on the CANCELLED row', async () => {
    const res = await http
      .post(`${T}/cancel`)
      .set('Authorization', BEARER)
      .send({ ...ref(), reason: 'E2E notes 153 — undo the move' });
    expect(res.status).toBe(201);
    posted = false;

    const [original] = await prisma.$queryRaw<{ avh_reversal_voucher_id: string | null }[]>`
      SELECT avh_reversal_voucher_id FROM accounts.acc_voucher_header
       WHERE avh_src_module = 'STOCK' AND avh_src_doc_type = 'TRANSFER_OUT'
         AND avh_src_doc_id = ${svhId}::uuid AND avh_is_deleted = false
       ORDER BY avh_created_on LIMIT 1`;
    expect(original.avh_reversal_voucher_id).not.toBeNull();

    const list = await http.get(T).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      accYear: SCOPE.accYear,
      status: 'CANCELLED',
      search: res.body.data.header.refno,
    });
    expect(list.status).toBe(200);
    expect(list.body.data.items).toEqual([
      // 2 + 1 free moved, as the list showed it before the cancel.
      expect.objectContaining({ svhId, status: 'CANCELLED', totalQty: 3, lineCount: 1 }),
    ]);
    // Cleared: the teardown has nothing left to undo.
    svhId = undefined;
  });
});
