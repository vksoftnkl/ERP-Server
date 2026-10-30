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
 * Notes 156 (2026-10-26) — a branch transfer's labour posts with each half:
 * the despatch's LOADING at despatch, at the sending branch; the receipt's
 * UNLOADING when it posts, at the receiving branch. Live DB, HTTP level.
 *
 * One round trip of 3 of a lot, test branch → Counter2 and back,
 * through the API only (never a raw-SQL teardown — memory
 * stale-transfer-http-suites-are-destructive). VALUE-NEUTRAL by choice of item:
 * one with no stock at the receiving branch, so the return carries back the
 * very cost the stock left with and no average moves — asserted at the end.
 * The labour vouchers stay: a despatch is never cancelled, and that is the point.
 *
 * Run with --runInBand: the menu-41 grant is a shared row.
 */

const T = '/api/v1/stock/transfer';
const R = `${T}/receive`;
const BEARER = 'Bearer dummy-test-token';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1
const COMPANY_ID = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const HOME_BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65'; // Counter2
const ACC_YEAR = '2026-2027';
const DEVICE_ID = '019e4e4c-9f08-7211-afe0-409b88a62180'; // no branch of its own

const prisma = new PrismaClient();
let menuRights: MenuRightsMemo | null = null;

const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

interface Holding {
  godown_id: string;
  item_id: string;
  lot_id: string;
  base_uom_id: string;
}
interface Figures {
  on_hand: string;
  lot_avg: string;
  item_avg: string | null;
}

describe('Branch transfer labour posts with each half — notes 156 (e2e, live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let holding: Holding;
  let farGodown: string;
  let crew: string[];
  let before: Figures;
  /** Every document this run raised, for the report if a case fails half way. */
  const raised: string[] = [];
  const ids: Record<'out1' | 'in1' | 'out2' | 'in2', string | undefined> = {
    out1: undefined,
    in1: undefined,
    out2: undefined,
    in2: undefined,
  };

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
    remarks: 'E2E notes 156 — branch labour',
    ...over,
  });
  const ref = (svhId: string, branchId: string) => ({
    svhId,
    accYear: ACC_YEAR,
    companyId: COMPANY_ID,
    branchId,
    userId: ACTOR,
  });
  const labourVouchers = (srcDocType: string, srcDocId: string) =>
    prisma.$queryRaw<
      { branch_id: string; type_code: string; status: string; legs: string }[]
    >`
      SELECT h.avh_branch_id AS branch_id, t.vchr_type_code AS type_code, h.avh_voucher_status AS status,
             (SELECT string_agg(v.av_role || ' ' || v.av_dr_cr || ' ' || v.av_amount::text, ', ' ORDER BY v.av_dr_cr DESC)
                FROM accounts.acc_vouchers v
               WHERE v.av_voucher_id = h.avh_voucher_id AND v.av_is_deleted = false) AS legs
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       WHERE h.avh_src_module = 'STOCK' AND h.avh_src_doc_type = ${srcDocType}
         AND h.avh_src_doc_id = ${srcDocId}::uuid AND h.avh_is_deleted = false`;

  beforeAll(async () => {
    menuRights = await grantMenuRights(prisma, [STOCK_TRANSFER_MENU]);
    const [found] = await prisma.$queryRaw<Holding[]>`
      SELECT b.sbl_godown_id AS godown_id, b.sbl_item_id AS item_id, b.sbl_lot_id AS lot_id,
             b.sbl_base_uom_id AS base_uom_id
        FROM stock.stock_balance b
        JOIN inventory.item_master i ON i.item_id = b.sbl_item_id
        JOIN inventory.item_unit_conversion c ON c.iuc_id = b.sbl_base_uom_id
        -- The godown must be one of the branch's own: dev data holds balances
        -- filed under a branch whose godown belongs to another, which the
        -- preflight rightly refuses to move.
        JOIN inventory.godown_locations g ON g.gdl_id = b.sbl_godown_id AND g.gdl_branch_id = b.sbl_branch_id
       WHERE b.sbl_company_id = ${COMPANY_ID}::uuid AND b.sbl_branch_id = ${HOME_BRANCH}::uuid
         AND b.sbl_bucket = 'SALEABLE' AND b.sbl_is_deleted = false AND b.sbl_available_qty >= 5
         AND i.item_is_active AND NOT i.item_is_deleted
         AND c.iuc_to_base_factor = 1
         -- Nothing of the item at the receiving branch: the round trip is then
         -- value-neutral (see the class note).
         AND NOT EXISTS (SELECT 1 FROM stock.stock_balance o
                          WHERE o.sbl_company_id = b.sbl_company_id AND o.sbl_branch_id = ${OTHER_BRANCH}::uuid
                            AND o.sbl_item_id = b.sbl_item_id AND o.sbl_on_hand_qty <> 0)
       ORDER BY b.sbl_available_qty DESC
       LIMIT 1`;
    if (!found) {
      throw new Error('No holding fit for a value-neutral round trip (5+ available, nothing at Counter2)');
    }
    holding = found;
    const [far] = await prisma.$queryRaw<{ gdl_id: string }[]>`
      SELECT gdl_id FROM inventory.godown_locations WHERE gdl_branch_id = ${OTHER_BRANCH}::uuid
       ORDER BY gdl_name LIMIT 1`;
    farGodown = far.gdl_id;
    crew = (
      await prisma.$queryRaw<{ emp_id: string }[]>`
        SELECT emp_id FROM public.employee_master
         WHERE emp_company_id = ${COMPANY_ID}::uuid AND emp_is_deleted = false ORDER BY emp_id LIMIT 2`
    ).map((row) => row.emp_id);
    before = await figures();

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-notes-156',
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
    await deleteOwnDrafts();
  }, 120_000);

  /**
   * A run that stops before a document posts leaves it a DRAFT — deleted here
   * through the API, never by SQL. A despatch already in transit cannot be
   * undone that way and is only reported (the warning below).
   */
  const deleteOwnDrafts = async () => {
    const drafts = await prisma.$queryRaw<{ svh_id: string; svh_voucher_type: string; svh_branch_id: string }[]>`
      SELECT svh_id, svh_voucher_type, svh_branch_id FROM stock.stock_voucher
       WHERE svh_company_id = ${COMPANY_ID}::uuid AND svh_acc_year = ${ACC_YEAR}::bpchar
         AND svh_status = 'DRAFT' AND svh_is_deleted = false
         AND svh_remarks = 'E2E notes 156 — branch labour'`;
    for (const draft of drafts) {
      await http
        .delete(draft.svh_voucher_type === 'TRANSFER_IN' ? R : T)
        .set('Authorization', BEARER)
        .query({ svhId: draft.svh_id, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: draft.svh_branch_id });
    }
  };

  afterAll(async () => {
    if (http) {
      await deleteOwnDrafts();
    }
    await restoreMenuRights(prisma, menuRights);
    if (!ids.in2 && raised.length) {
      // No raw-SQL undo: say what is left so it can be finished through the API.
      // eslint-disable-next-line no-console
      console.warn(`notes 156 e2e stopped half way; documents raised: ${raised.join(', ')}`);
    }
    await app?.close();
    await prisma.$disconnect();
  });

  // Sent as 3, not 2 + 1 free: notes 160 A refuses free goods the lot never
  // received, and no holding of this branch has any. The labour is the same
  // ((qty + free) × rate).
  it('the despatch posts its LOADING at despatch, at the sending branch — 3 × 1.50 = 4.50', async () => {
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
        lines: [line(holding.godown_id, 3, { loadRate: 1.5 })],
      });
    expect({ status: saved.status, body: saved.body }).toMatchObject({ status: 201 });
    ids.out1 = saved.body.data.header.svhId;
    raised.push(saved.body.data.header.refno);
    expect(saved.body.data.header).toMatchObject({ loadingCharge: 4.5, unloadingCharge: 0 });

    const despatched = await http.post(`${T}/despatch`).set('Authorization', BEARER).send(ref(ids.out1!, HOME_BRANCH));
    expect({ status: despatched.status, body: despatched.body }).toMatchObject({ status: 201 });
    expect(despatched.body.data).toMatchObject({ sameBranch: false, status: 'IN_TRANSIT' });

    await expect(labourVouchers('TRANSFER_OUT', ids.out1!)).resolves.toEqual([
      {
        branch_id: HOME_BRANCH,
        type_code: 'TRF',
        status: 'POSTED',
        legs: 'LOADING_CHARGES DR 4.50, LOADING_PAYABLE CR 4.50',
      },
    ]);
  });

  it('the receipt still refuses a loading box (WRONG_HALF) and posts its UNLOADING at the receiving branch — 3 × 0.50 = 1.50', async () => {
    const receipt = (over: Record<string, unknown>, lines: unknown[]) => ({
      header: header(OTHER_BRANCH, {
        linkSrcDocId: ids.out1,
        linkSrcAccYear: ACC_YEAR,
        unloadEnabled: true,
        unloadmanIds: crew.slice(0, 1),
        ...over,
      }),
      lines,
    });
    const wrongHalf = await http
      .post(R)
      .set('Authorization', BEARER)
      .send(receipt({}, [line(farGodown, 3, { loadRate: 1 })]));
    expect({ status: wrongHalf.status, body: wrongHalf.body }).toMatchObject({ status: 422 });
    expect(wrongHalf.body.errors).toEqual([
      expect.objectContaining({ field: 'lines.0.loadRate', code: 'STOCK_LOADING_WRONG_HALF' }),
    ]);

    const saved = await http
      .post(R)
      .set('Authorization', BEARER)
      .send(receipt({}, [line(farGodown, 3, { unloadRate: 0.5 })]));
    expect({ status: saved.status, body: saved.body }).toMatchObject({ status: 201 });
    ids.in1 = saved.body.data.header.svhId;
    raised.push(saved.body.data.header.refno);
    expect(saved.body.data.header).toMatchObject({ loadingCharge: 0, unloadingCharge: 1.5 });

    const posted = await http.post(`${R}/post`).set('Authorization', BEARER).send(ref(ids.in1!, OTHER_BRANCH));
    expect({ status: posted.status, body: posted.body }).toMatchObject({ status: 201 });
    expect(posted.body.data.outVoucher).toMatchObject({ status: 'RECEIVED', closed: true });

    await expect(labourVouchers('TRANSFER_IN', ids.in1!)).resolves.toEqual([
      {
        branch_id: OTHER_BRANCH,
        type_code: 'TRF',
        status: 'POSTED',
        legs: 'LOADING_CHARGES DR 1.50, LOADING_PAYABLE CR 1.50',
      },
    ]);
    // The despatch's loading voucher is untouched by its receipt.
    await expect(labourVouchers('TRANSFER_OUT', ids.out1!)).resolves.toHaveLength(1);
  });

  it('a return with no labour posts no voucher, and the round trip leaves the holding and its cost as they were', async () => {
    const out2 = await http
      .post(T)
      .set('Authorization', BEARER)
      .send({
        header: header(OTHER_BRANCH, {
          fromGodownId: farGodown,
          toGodownId: holding.godown_id,
          toBranchId: HOME_BRANCH,
        }),
        lines: [line(farGodown, 3)],
      });
    expect({ status: out2.status, body: out2.body }).toMatchObject({ status: 201 });
    ids.out2 = out2.body.data.header.svhId;
    raised.push(out2.body.data.header.refno);
    const despatched = await http.post(`${T}/despatch`).set('Authorization', BEARER).send(ref(ids.out2!, OTHER_BRANCH));
    expect({ status: despatched.status, body: despatched.body }).toMatchObject({ status: 201 });

    const in2 = await http
      .post(R)
      .set('Authorization', BEARER)
      .send({
        header: header(HOME_BRANCH, { linkSrcDocId: ids.out2, linkSrcAccYear: ACC_YEAR }),
        lines: [line(holding.godown_id, 3)],
      });
    expect({ status: in2.status, body: in2.body }).toMatchObject({ status: 201 });
    ids.in2 = in2.body.data.header.svhId;
    raised.push(in2.body.data.header.refno);
    const posted = await http.post(`${R}/post`).set('Authorization', BEARER).send(ref(ids.in2!, HOME_BRANCH));
    expect({ status: posted.status, body: posted.body }).toMatchObject({ status: 201 });

    await expect(labourVouchers('TRANSFER_OUT', ids.out2!)).resolves.toEqual([]);
    await expect(labourVouchers('TRANSFER_IN', ids.in2!)).resolves.toEqual([]);

    const after = await figures();
    expect(Number(after.on_hand)).toBeCloseTo(Number(before.on_hand), 6);
    expect(Number(after.lot_avg)).toBeCloseTo(Number(before.lot_avg), 4);
    if (before.item_avg !== null) {
      expect(Number(after.item_avg)).toBeCloseTo(Number(before.item_avg), 4);
    }
  });
});
