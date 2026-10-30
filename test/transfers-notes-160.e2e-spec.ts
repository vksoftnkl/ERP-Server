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
 * Notes 160 (2026-10-27) — transfers. Live DB, HTTP level.
 *
 *   A. free goods leave only from free goods that came in: a transfer line's
 *      freeQty above the holding's free balance is a 422 at lines.<i>.freeQty,
 *      and /stock/adjustment/pick-stock says what the free balance is.
 *   B. POST /stock/transfer/recall takes back a branch despatch nobody received
 *      — refused while a receipt (a draft one included) names it.
 *   C. the despatch's number carries the device's short code, its serial
 *      padded to five digits: TRF/2026-2027/D1/00017.
 *
 * One despatch test branch → Counter2, recalled. VALUE-NEUTRAL: the recall
 * reverses the OUT at the cost it left with, so the holding and both averages
 * end as they began (asserted). Through the API only — the draft receipt is
 * deleted, the despatch recalled; never a raw-SQL teardown (memory
 * stale-transfer-http-suites-are-destructive). What stays: the CANCELLED
 * despatch and its reversed loading voucher.
 *
 * Run with --runInBand: the menu grants are shared rows.
 */

const T = '/api/v1/stock/transfer';
const R = `${T}/receive`;
const BEARER = 'Bearer dummy-test-token';
const REMARKS = 'E2E notes 160 — recall';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1
const COMPANY_ID = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const HOME_BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65'; // Counter2
const ACC_YEAR = '2026-2027';
const DEVICE_ID = '019e4e4c-9f08-7211-afe0-409b88a62180'; // the office PC, no branch of its own
const BRANCH_OUTWARD_MENU = 192;
const STOCK_ADJUSTMENT_MENU = 264; // pick-stock is judged on it

const prisma = new PrismaClient();
let menuRights: MenuRightsMemo | null = null;

const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

interface Holding {
  godown_id: string;
  item_id: string;
  lot_id: string;
  base_uom_id: string;
  free_available: string;
}
interface Figures {
  on_hand: string;
  lot_avg: string;
  item_avg: string | null;
}

describe('Transfers — free stock, recall, short numbers — notes 160 (e2e, live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let holding: Holding;
  let farGodown: string;
  let crew: string[];
  let before: Figures;
  let farTransitBefore: string;
  let deviceCode: string;
  let outId: string | undefined;
  let outRefno: string | undefined;
  let draftReceiptId: string | undefined;

  const figures = async (): Promise<Figures> => {
    const [row] = await prisma.$queryRaw<Figures[]>`
      SELECT b.sbl_on_hand_qty::text AS on_hand, b.sbl_avg_cost_rate::text AS lot_avg,
             (SELECT c.sic_avg_cost_rate::text FROM stock.stock_item_cost c
               WHERE c.sic_company_id = b.sbl_company_id AND c.sic_branch_id = b.sbl_branch_id
                 AND c.sic_item_id = b.sbl_item_id LIMIT 1) AS item_avg
        FROM stock.stock_balance b
       WHERE b.sbl_company_id = ${COMPANY_ID}::uuid AND b.sbl_branch_id = ${HOME_BRANCH}::uuid
         AND b.sbl_godown_id = ${holding.godown_id}::uuid AND b.sbl_lot_id = ${holding.lot_id}::uuid
         AND b.sbl_bucket = 'SALEABLE'`;
    return row;
  };
  /** The receiving holding's in-transit figure (0 when it has no balance row yet). */
  const farTransit = async (): Promise<string> => {
    const [row] = await prisma.$queryRaw<{ qty: string }[]>`
      SELECT COALESCE(SUM(sbl_transit_in_qty), 0)::text AS qty FROM stock.stock_balance
       WHERE sbl_company_id = ${COMPANY_ID}::uuid AND sbl_branch_id = ${OTHER_BRANCH}::uuid
         AND sbl_godown_id = ${farGodown}::uuid AND sbl_lot_id = ${holding.lot_id}::uuid
         AND sbl_is_deleted = false`;
    return row.qty;
  };
  const line = (godownId: string, qty: number, over: Record<string, unknown> = {}) => ({
    lineNo: 1,
    itemId: holding.item_id,
    uomId: holding.base_uom_id,
    baseUomId: holding.base_uom_id,
    toBaseFactor: 1,
    godownId,
    lotId: holding.lot_id,
    bucket: 'SALEABLE',
    qty,
    baseQty: qty,
    ...over,
  });
  const header = (branchId: string, over: Record<string, unknown>) => ({
    accYear: ACC_YEAR,
    companyId: COMPANY_ID,
    branchId,
    deviceId: DEVICE_ID,
    docDate: today(),
    remarks: REMARKS,
    ...over,
  });
  const ref = (svhId: string, branchId: string) => ({
    svhId,
    accYear: ACC_YEAR,
    companyId: COMPANY_ID,
    branchId,
    userId: ACTOR,
  });

  beforeAll(async () => {
    menuRights = await grantMenuRights(prisma, [
      STOCK_TRANSFER_MENU,
      BRANCH_OUTWARD_MENU,
      STOCK_ADJUSTMENT_MENU,
    ]);
    const [found] = await prisma.$queryRaw<Holding[]>`
      SELECT b.sbl_godown_id AS godown_id, b.sbl_item_id AS item_id, b.sbl_lot_id AS lot_id,
             b.sbl_base_uom_id AS base_uom_id,
             GREATEST(b.sbl_free_in_qty - b.sbl_free_out_qty, 0)::text AS free_available
        FROM stock.stock_balance b
        JOIN inventory.item_master i ON i.item_id = b.sbl_item_id
        JOIN inventory.item_unit_conversion c ON c.iuc_id = b.sbl_base_uom_id
        JOIN inventory.godown_locations g ON g.gdl_id = b.sbl_godown_id AND g.gdl_branch_id = b.sbl_branch_id
       WHERE b.sbl_company_id = ${COMPANY_ID}::uuid AND b.sbl_branch_id = ${HOME_BRANCH}::uuid
         AND b.sbl_bucket = 'SALEABLE' AND b.sbl_is_deleted = false AND b.sbl_available_qty >= 5
         AND b.sbl_free_in_qty - b.sbl_free_out_qty <= 0
         AND i.item_is_active AND NOT i.item_is_deleted
         AND c.iuc_to_base_factor = 1
       ORDER BY b.sbl_available_qty DESC
       LIMIT 1`;
    if (!found) {
      throw new Error('No holding fit for the notes 160 run (5+ available, no free stock)');
    }
    holding = found;
    const [far] = await prisma.$queryRaw<{ gdl_id: string }[]>`
      SELECT gdl_id FROM inventory.godown_locations WHERE gdl_branch_id = ${OTHER_BRANCH}::uuid
       ORDER BY gdl_name LIMIT 1`;
    farGodown = far.gdl_id;
    crew = (
      await prisma.$queryRaw<{ emp_id: string }[]>`
        SELECT emp_id FROM public.employee_master
         WHERE emp_company_id = ${COMPANY_ID}::uuid AND emp_is_deleted = false ORDER BY emp_id LIMIT 1`
    ).map((row) => row.emp_id);
    const [device] = await prisma.$queryRaw<{ dev_code: string | null }[]>`
      SELECT dev_code FROM fixed.device_master WHERE dev_id = ${DEVICE_ID}::uuid`;
    deviceCode = device.dev_code ?? '';
    before = await figures();
    farTransitBefore = await farTransit();

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-notes-160',
      user_type: 'SUPER ADMIN',
      company_id: COMPANY_ID,
      branch_id: HOME_BRANCH,
      device_id: DEVICE_ID,
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
    if (http) {
      // A run stopped half way: the draft receipt is deleted and the despatch
      // recalled, both through the API.
      if (draftReceiptId) {
        await http
          .delete(R)
          .set('Authorization', BEARER)
          .query({ svhId: draftReceiptId, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: OTHER_BRANCH });
      }
      if (outId) {
        const [out] = await prisma.$queryRaw<{ svh_status: string }[]>`
          SELECT svh_status FROM stock.stock_voucher WHERE svh_id = ${outId}::uuid AND svh_acc_year = ${ACC_YEAR}::bpchar`;
        if (out?.svh_status === 'IN_TRANSIT') {
          await http
            .post(`${T}/recall`)
            .set('Authorization', BEARER)
            .send({ ...ref(outId, HOME_BRANCH), reason: `${REMARKS} (teardown)` });
        } else if (out?.svh_status === 'DRAFT') {
          await http
            .delete(T)
            .set('Authorization', BEARER)
            .query({ svhId: outId, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: HOME_BRANCH });
        }
      }
    }
    await restoreMenuRights(prisma, menuRights);
    await app?.close();
    await prisma.$disconnect();
  });

  it('A: pick-stock reports the holding\'s free balance as freeAvailableQty', async () => {
    const res = await http
      .get('/api/v1/stock/adjustment/pick-stock')
      .set('Authorization', BEARER)
      .query({ companyId: COMPANY_ID, branchId: HOME_BRANCH, godownId: holding.godown_id, itemId: holding.item_id });
    expect({ status: res.status }).toEqual({ status: 200 });
    const row = (res.body.data as Array<{ lotId: string; bucket: string; freeAvailableQty: number }>).find(
      (r) => r.lotId === holding.lot_id && r.bucket === 'SALEABLE',
    );
    expect(row?.freeAvailableQty).toBe(Number(holding.free_available));
  });

  it('A: a transfer line taking free stock the lot never received is refused at lines.<i>.freeQty', async () => {
    const res = await http
      .post(T)
      .set('Authorization', BEARER)
      .send({
        header: header(HOME_BRANCH, {
          fromGodownId: holding.godown_id,
          toGodownId: farGodown,
          toBranchId: OTHER_BRANCH,
        }),
        lines: [line(holding.godown_id, 2, { freeQty: 1, freeBaseQty: 1 })],
      });
    expect({ status: res.status }).toEqual({ status: 422 });
    expect(res.body.errors).toEqual([
      expect.objectContaining({ field: 'lines.0.freeQty', code: 'STOCK_FREE_QTY_EXCEEDS_FREE_STOCK' }),
    ]);
  });

  it('C: the despatch is numbered with the device code and a five-digit serial', async () => {
    expect(deviceCode).toMatch(/^[A-Z0-9_-]{1,10}$/);
    const saved = await http
      .post(T)
      .set('Authorization', BEARER)
      .send({
        header: header(HOME_BRANCH, {
          fromGodownId: holding.godown_id,
          toGodownId: farGodown,
          toBranchId: OTHER_BRANCH,
          loadEnabled: true,
          loadmanIds: crew,
        }),
        lines: [line(holding.godown_id, 2, { loadRate: 1.5 })],
      });
    expect({ status: saved.status, body: saved.body }).toMatchObject({ status: 201 });
    outId = saved.body.data.header.svhId as string;
    outRefno = saved.body.data.header.refno as string;
    expect(outRefno).toMatch(new RegExp(`^TRF/${ACC_YEAR}/${deviceCode}/\\d{5,}$`));

    const despatched = await http.post(`${T}/despatch`).set('Authorization', BEARER).send(ref(outId, HOME_BRANCH));
    expect({ status: despatched.status, body: despatched.body }).toMatchObject({ status: 201 });
    expect(despatched.body.data).toMatchObject({ sameBranch: false, status: 'IN_TRANSIT' });
  });

  it('B: a recall is refused while a receipt — a draft one too — names the despatch', async () => {
    const draft = await http
      .post(R)
      .set('Authorization', BEARER)
      .send({
        header: header(OTHER_BRANCH, { linkSrcDocId: outId, linkSrcAccYear: ACC_YEAR }),
        lines: [line(farGodown, 2)],
      });
    expect({ status: draft.status, body: draft.body }).toMatchObject({ status: 201 });
    draftReceiptId = draft.body.data.header.svhId as string;

    const refused = await http
      .post(`${T}/recall`)
      .set('Authorization', BEARER)
      .send({ ...ref(outId!, HOME_BRANCH), reason: 'Lorry never left' });
    expect({ status: refused.status }).toEqual({ status: 409 });
    expect(refused.body.errors).toEqual([
      expect.objectContaining({
        code: 'STOCK_TRANSFER_RECALL_RECEIVED',
        message: expect.stringContaining('Counter2 has already keyed a receipt against it'),
      }),
    ]);

    const deleted = await http
      .delete(R)
      .set('Authorization', BEARER)
      .query({ svhId: draftReceiptId, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: OTHER_BRANCH });
    expect({ status: deleted.status }).toEqual({ status: 200 });
    draftReceiptId = undefined;
  });

  it('B: the recall puts the stock back, closes the transit rows, reverses the loading voucher, CANCELLED', async () => {
    const res = await http
      .post(`${T}/recall`)
      .set('Authorization', BEARER)
      .send({ ...ref(outId!, HOME_BRANCH), reason: 'Lorry never left' });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 201 });
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', rowsReversed: 1, transitRowsClosed: 1 });
    expect(res.body.message).toBe(`${outRefno} recalled — 1 reversal rows, 1 transit rows closed`);

    // The stock is back in the From godown at the same lot and cost.
    await expect(figures()).resolves.toEqual(before);
    // Nothing of it is on its way to Counter2 any more.
    await expect(farTransit()).resolves.toBe(farTransitBefore);
    const transit = await prisma.$queryRaw<{ stt_status: string }[]>`
      SELECT stt_status FROM stock.stock_transit
       WHERE stt_out_voucher_id = ${outId}::uuid AND stt_out_acc_year = ${ACC_YEAR}::bpchar`;
    expect(transit).toEqual([{ stt_status: 'CANCELLED' }]);
    const inbound = await http
      .get(`${R}/inbound`)
      .set('Authorization', BEARER)
      .query({ companyId: COMPANY_ID, branchId: OTHER_BRANCH, limit: 500 });
    expect({ status: inbound.status }).toEqual({ status: 200 });
    expect(
      (inbound.body.data.items as Array<{ outVoucherId: string }>).some((row) => row.outVoucherId === outId),
    ).toBe(false);

    // The loading voucher (2 × 1.50) has its reversal.
    const [loading] = await prisma.$queryRaw<{ status: string; reversed: boolean }[]>`
      SELECT avh_voucher_status AS status, avh_reversal_voucher_id IS NOT NULL AS reversed
        FROM accounts.acc_voucher_header
       WHERE avh_src_module = 'STOCK' AND avh_src_doc_type = 'TRANSFER_OUT'
         AND avh_src_doc_id = ${outId}::uuid AND avh_is_deleted = false
         AND avh_against_voucher_id IS NULL`;
    expect(loading).toEqual({ status: 'CANCELLED', reversed: true });

    // Who and why are on the trail.
    const [step] = await prisma.$queryRaw<{ from_status: string; to_status: string; remarks: string }[]>`
      SELECT tsl_from_status AS from_status, tsl_to_status AS to_status, tsl_remarks AS remarks
        FROM public.txn_status_log
       WHERE tsl_src_doc_id = ${outId}::uuid ORDER BY tsl_seq_no DESC LIMIT 1`;
    expect(step).toEqual({ from_status: 'IN_TRANSIT', to_status: 'CANCELLED', remarks: 'Recalled: Lorry never left' });
  });

  it('B: a second recall is refused — it was already cancelled', async () => {
    const res = await http
      .post(`${T}/recall`)
      .set('Authorization', BEARER)
      .send({ ...ref(outId!, HOME_BRANCH), reason: 'Again' });
    expect({ status: res.status }).toEqual({ status: 409 });
    expect(res.body.errors).toEqual([expect.objectContaining({ code: 'STOCK_VOUCHER_ALREADY_CANCELLED' })]);
    outId = undefined;
  });
});
