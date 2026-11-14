import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { bootApp as bootTillApp } from '../helpers/payment-e2e';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from '../helpers/menu-rights';
import { dropTestDay } from '../helpers/till-cleanup';
import {
  ACC_YEAR,
  API,
  BEARER,
  BRANCH,
  COMPANY,
  TENDER,
  WALK_IN,
  WALK_IN_NAME,
  billBody,
  billKeys,
  grantSalesRights,
  makeItem,
  postOpeningStock,
  revokeSalesRights,
  runTag,
  saleReturnBody,
  saleReturnKeys,
  useHarnessDevice,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales-e2e.harness';

/**
 * A sale return's cash refund and the till session it is paid out of
 * (plan v5 D7 / D32, gap 33; the amend rule the user asked for 2026-11-14),
 * end to end on a counter's device:
 *
 *   1 · a CASH return posted on the counter's device refunds out of the live
 *       session — header and tender rows carry it;
 *   2 · amended while the session still takes money, it re-posts in that
 *       session with its changed refund judged against the drawer;
 *   3 · once billing ends (COUNTING) the refund has been counted: neither an
 *       amend nor a cancel may undo it — 409 SALES_RETURN_REFUND_SESSION_CLOSED;
 *   4 · History › Revisions: the create and the amend are revisions 1 and 2
 *       (log_rev_no, notes 89); the post is a status step.
 *
 * Like till-money-paths-http: the suite registers its OWN device and binds its
 * own counter to it, so no other suite's device is governed by the till.
 * Teardown removes its till rows by the ids it made, then (the session row
 * gone, so the rule no longer binds) cancels the return and the bill.
 *
 * Run with --runInBand.
 */

const tag = runTag();
const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285];

let app: INestApplication;
let h: Harness;
const prisma = new PrismaClient();
let tillRights: MenuRightsMemo;
let salesRights: RightsMemo;
let deviceId: string;
let safeId: string;
let counterId: string;
let item: Item;
let note500: string;
let bill: Record<string, any>;
let srId: string;
let session: { tssId: string; tssAccYear: string; tssBusinessDate: string };
let daysBefore = new Set<string>();

const post = (path: string, body: object) =>
  h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);

function expectStatus(res: request.Response, status: number): void {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

const key = () => ({
  companyId: COMPANY,
  branchId: BRANCH,
  accYear: session.tssAccYear,
  tssId: session.tssId,
});

/** The return body: 1 of the bill's 4 units back, refunded in cash. */
const returnBody = (refund: number) =>
  saleReturnBody({
    custId: WALK_IN,
    custName: WALK_IN_NAME,
    bill: { sbId: bill.sbId, refno: bill.sbBillRefno },
    lines: [{ item, qty: 1, rate: 100, sbiId: bill.items[0].sbiId, costRate: 20 }],
    settleMode: 'CASH',
    tenders: [{ tenderId: TENDER.CASH, amount: refund }],
    usrRefno: `E2E-SRT-${tag}`,
    reason: 'e2e sale return till',
  });

async function returnRow(): Promise<{ s: string | null; st: string; rev: number; refund: string }> {
  const [r] = await prisma.$queryRaw<
    { s: string | null; st: string; rev: number; refund: string }[]
  >`
    SELECT sr_session_id::text AS s, sr_status AS st, sr_revision_no AS rev, sr_refund_amt::text AS refund
      FROM sales.sale_return WHERE sr_id = ${srId}::uuid AND sr_acc_year = ${ACC_YEAR}`;
  return r;
}

async function tenderSessions(): Promise<{ s: string | null; amt: string }[]> {
  return prisma.$queryRaw<{ s: string | null; amt: string }[]>`
    SELECT td_session_id::text AS s, td_amount::text AS amt FROM accounts.acc_tender_detail
     WHERE td_src_doc_type = 'SALE_RETURN' AND td_src_doc_id = ${srId}::uuid AND td_is_deleted = false`;
}

beforeAll(async () => {
  const days = await prisma.$queryRaw<{ id: string }[]>`
    SELECT tbd_id::text AS id FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid`;
  daysBefore = new Set(days.map((d) => d.id));
  const [device] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-sr-till-${tag}`}, 'E2E sale return till PC', 'Desktop')
    RETURNING dev_id`;
  deviceId = device.dev_id;
  const [d500] = await prisma.$queryRaw<{ tdn_id: string }[]>`
    SELECT tdn_id FROM accounts.till_denomination
     WHERE tdn_company_id IS NULL AND tdn_value = 500 AND tdn_kind = 'NOTE' AND tdn_is_deleted = false`;
  note500 = d500.tdn_id;

  tillRights = await grantMenuRights(prisma, TILL_MENUS);
  salesRights = await grantSalesRights(prisma);

  app = await bootTillApp({ device_id: deviceId });
  h = { app, http: request(app.getHttpServer()), prisma };

  item = await makeItem(prisma, `E2E-SRT-${tag}`);
  await useHarnessDevice(prisma); // the opening stock posts on the sales harness's device
  await postOpeningStock(h, item, 20, 20, `E2E-SRT-${tag} opening`);

  const safe = await post('till/safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2ER${tag}`.slice(0, 20),
    tsfName: 'E2E sale return safe',
    tsfIsDropSafe: true,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const counter = await post('till/counters/create', {
    tcnCompanyId: COMPANY,
    tcnBranchId: BRANCH,
    tcnCode: `E2ER${tag}`.slice(0, 20),
    tcnName: 'E2E sale return counter',
    tcnDeviceId: deviceId,
    tcnSafeId: safeId,
    tcnDefaultFloat: 1000,
  });
  expectStatus(counter, 201);
  counterId = counter.body.data.tcnId;
}, 240_000);

afterAll(async () => {
  if (session) {
    const s = session.tssId;
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ${s}::uuid OR tev_device_id = ${deviceId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_session_id = ${s}::uuid`;
    // The till's OWN vouchers only — the bill's and the return's carry the session too, and stay.
    const vouchers = await prisma.$queryRaw<{ id: string; y: string }[]>`
      SELECT avh_voucher_id::text AS id, avh_acc_year AS y FROM accounts.acc_voucher_header
       WHERE avh_session_id = ${s}::uuid AND avh_src_module = 'TILL'`;
    for (const v of vouchers) {
      await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id = ${v.id}::uuid AND av_acc_year = ${v.y}`;
      await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${v.id}::uuid AND avh_acc_year = ${v.y}`;
    }
    const [day] = await prisma.$queryRaw<{ tss_day_id: string }[]>`
      SELECT tss_day_id::text FROM accounts.till_session WHERE tss_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_id = ${s}::uuid`;
    if (day && !daysBefore.has(day.tss_day_id)) {
      await dropTestDay(prisma, day.tss_day_id);
    }
  }
  if (srId) {
    // Any review the gate filed for this return outside the session.
    await prisma.$executeRaw`
      DELETE FROM accounts.till_approval WHERE tap_src_doc_type = 'SALE_RETURN' AND tap_src_doc_id = ${srId}::uuid`;
  }
  // The session row is gone, so the refund rule no longer binds: the return
  // first (it locks its bill), then the bill.
  if (srId && (await returnRow())?.st === 'POSTED') {
    expectStatus(
      await post('sale-returns/cancel', { ...saleReturnKeys(srId), reason: 'e2e teardown' }),
      201,
    );
  } else if (srId && (await returnRow())?.st === 'DRAFT') {
    await post('sale-returns/delete', saleReturnKeys(srId));
  }
  if (bill?.sbId) {
    await post('bills/cancel', { ...billKeys(bill.sbId), reason: 'e2e sale return till teardown' });
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counterId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_id = ${safeId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id = ${deviceId}::uuid`;
  if (salesRights) {
    await revokeSalesRights(prisma, salesRights);
  }
  await restoreMenuRights(prisma, tillRights);
  await app?.close();
  await prisma.$disconnect();
}, 120_000);

describe('A sale return refunded out of a till session', () => {
  it('posts its cash refund in the counter’s live session: header and tender rows carry it', async () => {
    const open = await post('till/sessions/open', {
      companyId: COMPANY,
      branchId: BRANCH,
      floatMode: 'ISSUED',
      floatIssued: 1000,
      lines: [{ tenderTypeId: 1, denominationId: note500, qty: 2 }],
    });
    expectStatus(open, 201);
    session = open.body.data;

    const created = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 4, rate: 100 }],
        usrRefno: `E2E-SRT-${tag}-BILL`,
      }),
    );
    expectStatus(created, 201);
    const posted = await post('bills/post', billKeys(created.body.data.sbId));
    expectStatus(posted, 201);
    bill = posted.body.data;

    const draft = await post('sale-returns/create', returnBody(118));
    expectStatus(draft, 201);
    srId = draft.body.data.srId;
    const res = await post('sale-returns/post', saleReturnKeys(srId));
    expectStatus(res, 201);

    expect(await returnRow()).toEqual({ s: session.tssId, st: 'POSTED', rev: 1, refund: '118.00' });
    expect(await tenderSessions()).toEqual([{ s: session.tssId, amt: '118.00' }]);
  });

  it('amended while the session takes money: re-posts in it, the changed refund judged against the drawer', async () => {
    const res = await post('sale-returns/amend', {
      ...returnBody(100),
      srId,
      baseRevision: 1,
      editRemark: 'e2e: refund 100 in cash, the rest as a credit note',
    });
    expectStatus(res, 201);
    expect(res.body.data).toMatchObject({ srStatus: 'POSTED', srRevisionNo: 2 });

    expect(await returnRow()).toEqual({ s: session.tssId, st: 'POSTED', rev: 2, refund: '100.00' });
    expect(await tenderSessions()).toEqual([{ s: session.tssId, amt: '100.00' }]);
  });

  it('once billing ends the counted refund can be neither amended nor cancelled: 409 SALES_RETURN_REFUND_SESSION_CLOSED', async () => {
    expectStatus(await post('till/sessions/end-billing', key()), 200);

    const amend = await post('sale-returns/amend', {
      ...returnBody(90),
      srId,
      baseRevision: 2,
      editRemark: 'e2e: after the count began',
    });
    expectStatus(amend, 409);
    expect(amend.body.errors[0]).toMatchObject({
      code: 'SALES_RETURN_REFUND_SESSION_CLOSED',
      field: 'srId',
      status: 'COUNTING',
    });

    const cancel = await post('sale-returns/cancel', {
      ...saleReturnKeys(srId),
      reason: 'e2e: after the count began',
    });
    expectStatus(cancel, 409);
    expect(cancel.body.errors[0].code).toBe('SALES_RETURN_REFUND_SESSION_CLOSED');

    // Nothing moved: still revision 2, still refunded in the session.
    expect(await returnRow()).toEqual({ s: session.tssId, st: 'POSTED', rev: 2, refund: '100.00' });
  });

  it('History › Revisions: the create and the amend are revisions 1 and 2; the post is a status step', async () => {
    const rows = await prisma.$queryRaw<
      { action: string; rev: number | null; notes: string | null }[]
    >`
      SELECT log_action::text AS action, log_rev_no AS rev, log_notes AS notes FROM audit.audit_log
       WHERE log_screen_id = 101 AND log_pk = ${srId} ORDER BY log_date, log_rev_no NULLS FIRST`;
    const revisions = rows.filter((r) => r.rev !== null);
    expect(revisions.map((r) => [r.action, r.rev])).toEqual([
      ['insert', 1],
      ['update', 2],
    ]);
    expect(revisions[1].notes).toContain('amended to revision 2');
    // the post (and the amend's re-post) stay plain status rows
    expect(rows.filter((r) => r.rev === null).map((r) => r.action)).toEqual(['approve', 'approve']);
  });
});
