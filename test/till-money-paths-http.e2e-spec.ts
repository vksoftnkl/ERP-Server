import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { bootApp as bootTillApp } from './helpers/payment-e2e';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from './helpers/menu-rights';
import {
  ACC_YEAR,
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
  type Harness,
  type Item,
  type RightsMemo,
} from './sales/sales-e2e.harness';

/**
 * The till and the money paths (TILL_DESIGN.md §7.4, D7), end to end: a CASH
 * bill on a drawer at its block limit is refused until a drop (§8 S2); then
 * posted on a counter's device it lands in the live till session — the
 * bill, its tender rows and its voucher all carry it — the blind count
 * expects that cash, and once the drawer is being counted the bill can no
 * longer be cancelled (TILL_SESSION_CLOSED_USE_RETURN).
 *
 * The suite registers its OWN device and binds its own counter to it, so no
 * other suite's device (the sales harness's 'raman') is ever governed by the
 * till. Teardown removes the till rows and then cancels the bill through the
 * API, as the sales suites leave theirs.
 *
 * Run with --runInBand.
 */

const tag = runTag();
const TILL_MENUS = [271, 272, 273, 274, 275, 276];

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
let sbId: string;
let billAmt: number;
let session: { tssId: string; tssAccYear: string; tssBusinessDate: string };
/** Bills a later test POSTS (cancelled in teardown) and leaves as DRAFT (deleted). */
const postedBills: string[] = [];
const draftBills: string[] = [];

const post = (path: string, body: object) =>
  h.http.post(`/api/v1/${path}`).set('Authorization', BEARER).send(body);

function expectStatus(res: request.Response, status: number): void {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

const key = () => ({ companyId: COMPANY, branchId: BRANCH, accYear: session.tssAccYear, tssId: session.tssId });

beforeAll(async () => {
  const [device] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-till-money-${tag}`}, 'E2E till money PC', 'Desktop')
    RETURNING dev_id`;
  deviceId = device.dev_id;
  const [d500] = await prisma.$queryRaw<{ tdn_id: string }[]>`
    SELECT tdn_id FROM accounts.till_denomination
     WHERE tdn_company_id IS NULL AND tdn_value = 500 AND tdn_kind = 'NOTE' AND tdn_is_deleted = false`;
  note500 = d500.tdn_id;

  tillRights = await grantMenuRights(prisma, TILL_MENUS);
  salesRights = await grantSalesRights(prisma);
  // tester1 is the cashier here: switch the supervisor flag off.
  await prisma.$executeRaw`
    UPDATE public.user_menus SET um_can_override = false
     WHERE um_user_id = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'::uuid AND um_menu_id = 273 AND um_is_deleted = false`;

  app = await bootTillApp({ device_id: deviceId });
  h = { app, http: request(app.getHttpServer()), prisma };

  item = await makeItem(prisma, `E2E-TILL-${tag}`);
  await postOpeningStock(h, item, 20, 20, `E2E-TILL-${tag} opening`);

  const safe = await post('till/safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2EM${tag}`.slice(0, 20),
    tsfName: 'E2E money safe',
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const counter = await post('till/counters/create', {
    tcnCompanyId: COMPANY,
    tcnBranchId: BRANCH,
    tcnCode: `E2EM${tag}`.slice(0, 20),
    tcnName: 'E2E money counter',
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
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_session_id = ${s}::uuid`;
    // The till's OWN vouchers only — the bill's voucher carries the session too, and stays.
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
    if (day) {
      await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_day_id = ${day.tss_day_id}::uuid`;
      await prisma.$executeRaw`
        DELETE FROM accounts.till_business_day d WHERE d.tbd_id = ${day.tss_day_id}::uuid
           AND NOT EXISTS (SELECT 1 FROM accounts.till_session x WHERE x.tss_day_id = d.tbd_id)`;
    }
  }
  await prisma.$executeRaw`
    DELETE FROM public.app_setting_value
     WHERE asv_setting_key = 'till.day_cutoff' AND asv_branch_id = ${BRANCH}::uuid AND asv_created_by = 'e2e-till'`;
  // The session row is gone, so the D7 guard no longer applies: cancel as the sales suites do.
  for (const id of [sbId, ...postedBills].filter(Boolean)) {
    await post('bills/cancel', { ...billKeys(id), reason: 'e2e till money-path teardown' });
  }
  for (const id of draftBills) {
    await post('bills/delete', billKeys(id));
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

describe('A cash bill on a counter’s device', () => {
  it('cannot post with no open till session', async () => {
    const created = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 2, rate: 100 }],
        usrRefno: `E2E-TILL-${tag}`,
        // Today's client sends a random session uuid per app run (§4).
        extra: { sbSessionId: '019e0000-0000-7000-8000-000000000000' },
      }),
    );
    expectStatus(created, 201);
    sbId = created.body.data.sbId;
    billAmt = Number(created.body.data.sbBillAmt);
    const res = await post('bills/post', billKeys(sbId));
    expectStatus(res, 409);
    expect(res.body.errors[0].code).toBe('TILL_SESSION_REQUIRED');
  });

  it('posts in the live session: bill, tender rows and voucher all carry it', async () => {
    const open = await post('till/sessions/open', {
      companyId: COMPANY,
      branchId: BRANCH,
      floatMode: 'ISSUED',
      floatIssued: 1000,
      lines: [{ tenderTypeId: 1, denominationId: note500, qty: 2 }],
    });
    expectStatus(open, 201);
    session = open.body.data;

    // A drawer at its block limit takes no more billing (§8 S2) — until a drop.
    await prisma.$executeRaw`UPDATE accounts.till_counter SET tcn_cash_block_limit = 1000 WHERE tcn_id = ${counterId}::uuid`;
    const blocked = await post('bills/post', billKeys(sbId));
    expectStatus(blocked, 409);
    expect(blocked.body.errors[0].code).toBe('TILL_CASH_BLOCKED');
    const drop = await post('till/movements/create', { ...key(), kind: 'DROP', amount: 500, bagNo: 'B-1' });
    expectStatus(drop, 201);

    const res = await post('bills/post', billKeys(sbId));
    expectStatus(res, 201);
    const [bill] = await prisma.$queryRaw<{ s: string; c: string }[]>`
      SELECT sb_session_id::text AS s, sb_counter_id::text AS c FROM sales.sale_bill
       WHERE sb_id = ${sbId}::uuid AND sb_acc_year = ${ACC_YEAR}`;
    expect(bill).toEqual({ s: session.tssId, c: counterId });
    const tenders = await prisma.$queryRaw<{ s: string }[]>`
      SELECT td_session_id::text AS s FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = 'SALE_BILL' AND td_src_doc_id = ${sbId}::uuid AND td_is_deleted = false`;
    expect(tenders.length).toBeGreaterThan(0);
    expect(new Set(tenders.map((t) => t.s))).toEqual(new Set([session.tssId]));
    const [voucher] = await prisma.$queryRaw<{ s: string }[]>`
      SELECT avh_session_id::text AS s FROM accounts.acc_voucher_header
       WHERE avh_src_doc_type = 'SALE_BILL' AND avh_src_doc_id = ${sbId}::uuid AND avh_voucher_status = 'POSTED'`;
    expect(voucher.s).toBe(session.tssId);
  });

  it('a re-tender in the session is a RETENDER in its journal (notes 99 §7)', async () => {
    const created = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-TILL-${tag}-RETENDER`,
        extra: { sbSessionId: session.tssId },
      }),
    );
    expectStatus(created, 201);
    const id: string = created.body.data.sbId;
    const amount = Number(created.body.data.sbBillAmt);
    expectStatus(await post('bills/post', billKeys(id)), 201);
    postedBills.push(id);
    const [cash] = await prisma.$queryRaw<{ td_id: string }[]>`
      SELECT td_id::text FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = 'SALE_BILL' AND td_src_doc_id = ${id}::uuid
         AND td_is_deleted = false AND td_is_voided = false AND td_tender_type_id = 1`;
    // All of it to UPI, so the drawer's expectation is what it was before this bill.
    const res = await post('bills/retender', {
      ...billKeys(id),
      voids: [{ tdId: cash.td_id, reason: 'KEYED_WRONG' }],
      tenders: [{ tdTenderId: TENDER.UPI, tdAmount: amount, tdRefNo: `UTR-E2E-TILL-${tag}` }],
      remark: `E2E-TILL-${tag} it was UPI`,
    });
    expectStatus(res, 201);
    const events = await prisma.tillEvent.findMany({
      where: { tevSessionId: session.tssId, tevEventCode: 'RETENDER' },
      select: { tevSrcDocType: true, tevSrcDocId: true, tevAmount: true, tevCounterId: true, tevPayload: true },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({ tevSrcDocType: 'SALE_BILL', tevSrcDocId: id, tevCounterId: counterId }),
    );
    expect(Number(events[0].tevAmount)).toBe(amount);
    expect(events[0].tevPayload).toEqual(
      expect.objectContaining({
        voided: [expect.objectContaining({ tdId: cash.td_id, amount })],
        added: [expect.objectContaining({ amount })],
      }),
    );
  });

  it('REV 2 §2.7 — past the business-day cut-off the session bills no more, and says so in the journal', async () => {
    const created = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-TILL-${tag}-CUTOFF`,
        extra: { sbSessionId: session.tssId },
      }),
    );
    expectStatus(created, 201);
    draftBills.push(created.body.data.sbId);

    // A cut-off that puts NOW on another business date than the session's,
    // whatever the clock says when the suite runs.
    const [pick] = await prisma.$queryRaw<{ cutoff: string }[]>`
      SELECT c AS cutoff FROM (VALUES ('23:59'), ('00:00')) v(c)
       WHERE to_char(now() - (c || ':00')::interval, 'YYYY-MM-DD') <> ${session.tssBusinessDate}
       LIMIT 1`;
    await prisma.$executeRaw`
      INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_branch_id, asv_value, asv_created_by)
      VALUES ('till.day_cutoff', 'BRANCH', ${BRANCH}::uuid, ${pick.cutoff}, 'e2e-till')`;
    try {
      const res = await post('bills/post', billKeys(created.body.data.sbId));
      expectStatus(res, 409);
      expect(res.body.errors[0]).toEqual(
        expect.objectContaining({ code: 'TILL_SESSION_DAY_ENDED', sessionDate: session.tssBusinessDate }),
      );
      const logged = await prisma.tillEvent.count({
        where: { tevSessionId: session.tssId, tevEventCode: 'SESSION_DAY_ENDED' },
      });
      expect(logged).toBe(1);
    } finally {
      await prisma.$executeRaw`
        DELETE FROM public.app_setting_value
         WHERE asv_setting_key = 'till.day_cutoff' AND asv_branch_id = ${BRANCH}::uuid AND asv_created_by = 'e2e-till'`;
    }
  });

  it('the blind count expects the float + the bill’s cash, and the counted bill can no longer be cancelled', async () => {
    expectStatus(await post('till/sessions/end-billing', key()), 200);

    const cancel = await post('bills/cancel', { ...billKeys(sbId), reason: 'after the count began' });
    expectStatus(cancel, 409);
    expect(cancel.body.errors[0].code).toBe('TILL_SESSION_CLOSED_USE_RETURN');

    const count = await post('till/sessions/count', {
      ...key(),
      lines: [
        { tenderTypeId: 1, denominationId: note500, qty: 1 },
        { tenderTypeId: 1, enteredAmount: billAmt },
      ],
    });
    expectStatus(count, 200);
    expect(count.body.data.outcome).toBe('ACCEPTED');

    const close = await post('till/sessions/close', { ...key(), floatLeft: 0 });
    expectStatus(close, 200);
    expect(close.body.data.totals).toEqual(
      // the re-tendered bill counts as a bill; its money went to UPI, not the drawer
      expect.objectContaining({ billCount: 2, handedOver: 500 + billAmt, cashVariance: 0 }),
    );
    // 1000 float − 500 dropped + the bill's cash.
    expect(close.body.data.tenders.find((t: { tenderTypeId: number }) => t.tenderTypeId === 1)).toEqual(
      expect.objectContaining({ openAmount: 1000, salesAmount: billAmt, movedOut: 500, expected: 500 + billAmt }),
    );
  });

  it('REV 2 §2.6 — a bill made while billing was live but arriving after it is a LATE ARRIVAL: accepted, logged', async () => {
    const [s] = await prisma.$queryRaw<{ ended: Date }[]>`
      SELECT tss_billing_ended_on AS ended FROM accounts.till_session WHERE tss_id = ${session.tssId}::uuid`;
    const madeBefore = new Date(s.ended.getTime() - 60_000).toISOString();
    const late = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-TILL-${tag}-LATE`,
        extra: { sbSessionId: session.tssId, sbBillDatetime: madeBefore },
      }),
    );
    expectStatus(late, 201);
    const res = await post('bills/post', billKeys(late.body.data.sbId));
    expectStatus(res, 201);
    postedBills.push(late.body.data.sbId);
    const [bill] = await prisma.$queryRaw<{ s: string }[]>`
      SELECT sb_session_id::text AS s FROM sales.sale_bill WHERE sb_id = ${late.body.data.sbId}::uuid`;
    expect(bill.s).toBe(session.tssId);
    expect(
      await prisma.tillEvent.count({ where: { tevSessionId: session.tssId, tevEventCode: 'LATE_ARRIVAL' } }),
    ).toBe(1);
  });

  it('…and money made after the session closed is refused: TILL_SESSION_CLOSED', async () => {
    const after = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 1, rate: 100 }],
        usrRefno: `E2E-TILL-${tag}-AFTER`,
        extra: { sbSessionId: session.tssId },
      }),
    );
    expectStatus(after, 201);
    draftBills.push(after.body.data.sbId);
    const res = await post('bills/post', billKeys(after.body.data.sbId));
    expectStatus(res, 409);
    expect(res.body.errors[0].code).toBe('TILL_SESSION_CLOSED');
  });
});
