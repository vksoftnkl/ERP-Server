import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { bootApp as bootTillApp } from './helpers/payment-e2e';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from './helpers/menu-rights';
import { dropTestDay } from './helpers/till-cleanup';
import { TillSessionHeaderProvider } from '../src/modules/settings/print-render/data/providers/till.providers';
import type { PrintDataProvider } from '../src/modules/settings/print-render/data/print-data-provider.types';
import {
  ACC_YEAR,
  ACTOR,
  BEARER,
  BRANCH,
  COMPANY,
  WALK_IN,
  WALK_IN_NAME,
  billBody,
  billKeys,
  grantSalesRights,
  makeItem,
  postOpeningStock,
  revokeSalesRights,
  runTag,
  useHarnessDevice,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales/sales-e2e.harness';

/**
 * Void bill and void line (design REV 2, 2026-10-17), end to end on a counter's
 * device: a bill posted in the live session cannot be CANCELLED (409
 * SALES_USE_VOID); its void takes a VOID_BILL reason (the list, the note rule),
 * runs cancel's unwind, stamps the till_void evidence (never printed · printed
 * before the void, read from print_log · minutes after post · the session's
 * n-th void) and journals BILL_VOID; a second call is idempotent; the drawer's
 * expected cash drops; a company that switches the rule to ALWAYS under a
 * REFUSE gate gets 428 TILL_APPROVAL_REQUIRED (shipped: NEVER, nothing asked);
 * LINE_VOID is a device fact /till/events/batch accepts while a server code is
 * still refused; the session's Z header carries the void figures.
 *
 * The suite registers its OWN device and binds its own counter to it, as the
 * money-path suite does. Teardown deletes its till rows by their own ids and
 * the bills by the API, and restores every right it touched. Run with
 * --runInBand (the sales rights fixture).
 */

const tag = runTag();
const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285];
const SALE_INVOICE_PURPOSE = '01a041fa-d3c1-76b2-85e8-86494f756d06';

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
let session: { tssId: string; tssAccYear: string; tssBusinessDate: string };
let daysBefore = new Set<string>();
/** Every bill the suite posts: cancelled (idempotently, voided ones too) in teardown. */
const bills: string[] = [];
let unprinted: { sbId: string; amount: number };
let printed: { sbId: string; amount: number };
let reasons: { reasonId: string; code: string; needsNote: boolean }[];
let ruleId: string | null = null;

const post = (path: string, body: object) =>
  h.http.post(`/api/v1/${path}`).set('Authorization', BEARER).send(body);
const get = (path: string, query: Record<string, string>) =>
  h.http.get(`/api/v1/${path}`).set('Authorization', BEARER).query(query);

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
const reasonOf = (code: string) => reasons.find((r) => r.code === code)!;

async function postCashBill(
  suffix: string,
  qty: number,
): Promise<{ sbId: string; amount: number }> {
  const created = await post(
    'bills/create',
    billBody({
      custId: WALK_IN,
      custName: WALK_IN_NAME,
      lines: [{ item, qty, rate: 100 }],
      usrRefno: `E2E-VOID-${tag}-${suffix}`,
      extra: { sbSessionId: session.tssId },
    }),
  );
  expectStatus(created, 201);
  const sbId: string = created.body.data.sbId;
  bills.push(sbId);
  expectStatus(await post('bills/post', billKeys(sbId)), 201);
  return { sbId, amount: Number(created.body.data.sbBillAmt) };
}

beforeAll(async () => {
  const days = await prisma.$queryRaw<{ id: string }[]>`
    SELECT tbd_id::text AS id FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid`;
  daysBefore = new Set(days.map((d) => d.id));
  const [device] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-till-void-${tag}`}, 'E2E void PC', 'Desktop')
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
     WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = 273 AND um_is_deleted = false`;

  app = await bootTillApp({ device_id: deviceId });
  h = { app, http: request(app.getHttpServer()), prisma };

  item = await makeItem(prisma, `E2E-VOID-${tag}`);
  await useHarnessDevice(prisma);
  await postOpeningStock(h, item, 20, 20, `E2E-VOID-${tag} opening`);

  const safe = await post('till/safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2EV${tag}`.slice(0, 20),
    tsfName: 'E2E void safe',
    tsfIsDropSafe: true,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const counter = await post('till/counters/create', {
    tcnCompanyId: COMPANY,
    tcnBranchId: BRANCH,
    tcnCode: `E2EV${tag}`.slice(0, 20),
    tcnName: 'E2E void counter',
    tcnDeviceId: deviceId,
    tcnSafeId: safeId,
    tcnDefaultFloat: 1000,
  });
  expectStatus(counter, 201);
  counterId = counter.body.data.tcnId;

  const open = await post('till/sessions/open', {
    companyId: COMPANY,
    branchId: BRANCH,
    floatMode: 'ISSUED',
    floatIssued: 1000,
    lines: [{ tenderTypeId: 1, denominationId: note500, qty: 2 }],
  });
  expectStatus(open, 201);
  session = open.body.data;
}, 240_000);

afterAll(async () => {
  if (ruleId) {
    await prisma.$executeRaw`DELETE FROM accounts.till_approval_rule WHERE tar_id = ${ruleId}::uuid`;
  }
  await prisma.$executeRaw`
    DELETE FROM public.app_setting_value
     WHERE asv_setting_key = 'till.approval_gate' AND asv_branch_id = ${BRANCH}::uuid AND asv_created_by = 'e2e-void'`;
  if (session) {
    const s = session.tssId;
    await prisma.$executeRaw`DELETE FROM public.print_log WHERE plg_src_doc_id = ANY(${bills}::uuid[]) AND plg_printed_by = ${ACTOR}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_void WHERE tvd_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ${s}::uuid OR tev_device_id = ${deviceId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_session_id = ${s}::uuid OR tap_src_doc_id = ANY(${bills}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_session_id = ${s}::uuid`;
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
  // The session row is gone, so neither the use-void nor the D7 guard applies:
  // cancel as the sales suites do (a voided bill is already CANCELLED: idempotent).
  for (const id of bills) {
    await post('bills/cancel', { ...billKeys(id), reason: 'e2e void teardown' });
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

describe('Void bill (REV 2) — a cash bill in a live till session', () => {
  it('cannot be cancelled: 409 SALES_USE_VOID; void-check says VOID and lists the reasons', async () => {
    unprinted = await postCashBill('A', 2);
    const cancel = await post('bills/cancel', {
      ...billKeys(unprinted.sbId),
      reason: 'customer left',
    });
    expectStatus(cancel, 409);
    expect(cancel.body.errors[0]).toEqual(
      expect.objectContaining({ code: 'SALES_USE_VOID', field: 'sbId' }),
    );

    const check = await get('bills/void-check', billKeys(unprinted.sbId));
    expectStatus(check, 200);
    expect(check.body.data).toEqual(
      expect.objectContaining({
        route: 'VOID',
        code: null,
        canVoid: true,
        printed: false,
        printCount: 0,
        printFailed: false,
        nextVoidNo: 1,
        amount: unprinted.amount,
        cashAmount: unprinted.amount,
        session: expect.objectContaining({ tssId: session.tssId, status: 'OPEN' }),
        void: null,
      }),
    );
    reasons = check.body.data.reasons;
    expect(reasons.map((r) => r.code).sort()).toEqual([
      'CUST_LEFT',
      'OPERATOR_ERR',
      'PRICE_DISPUTE',
      'PRINTER_FAIL',
      'SYSTEM_ERR',
      'WRONG_ITEM',
    ]);
    expect(reasonOf('PRICE_DISPUTE').needsNote).toBe(true);
    expect(reasonOf('CUST_LEFT').needsNote).toBe(false);
  });

  it('refuses a reason off the list, and a reason that needs a note without one; nothing is written', async () => {
    const [other] = await prisma.$queryRaw<{ trs_id: string }[]>`
      SELECT trs_id FROM accounts.till_reason WHERE trs_category = 'NO_SALE' AND trs_company_id IS NULL AND trs_is_deleted = false LIMIT 1`;
    const wrong = await post('bills/void', { ...billKeys(unprinted.sbId), reasonId: other.trs_id });
    expectStatus(wrong, 422);
    expect(wrong.body.errors[0]).toEqual(
      expect.objectContaining({ code: 'TILL_REASON_INVALID', field: 'reasonId' }),
    );

    const noNote = await post('bills/void', {
      ...billKeys(unprinted.sbId),
      reasonId: reasonOf('PRICE_DISPUTE').reasonId,
    });
    expectStatus(noNote, 422);
    expect(noNote.body.errors[0]).toEqual(
      expect.objectContaining({ code: 'TILL_REASON_INVALID', field: 'note' }),
    );

    const [bill] = await prisma.$queryRaw<{ s: string }[]>`
      SELECT sb_status AS s FROM sales.sale_bill WHERE sb_id = ${unprinted.sbId}::uuid AND sb_acc_year = ${ACC_YEAR}`;
    expect(bill.s).toBe('POSTED');
    expect(await prisma.tillVoid.count({ where: { tvdSrcDocId: unprinted.sbId } })).toBe(0);
  });

  it('voids an unprinted bill: nothing asked, cancel’s unwind, the evidence row, BILL_VOID; a second call is idempotent', async () => {
    const res = await post('bills/void', {
      ...billKeys(unprinted.sbId),
      reasonId: reasonOf('CUST_LEFT').reasonId,
    });
    expectStatus(res, 201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        sbId: unprinted.sbId,
        sbStatus: 'CANCELLED',
        reversalVoucherRefno: expect.stringMatching(/^rev/i),
        void: expect.objectContaining({
          sessionId: session.tssId,
          cashierId: ACTOR,
          voidedBy: ACTOR,
          amount: unprinted.amount,
          cashAmount: unprinted.amount,
          reasonCode: 'CUST_LEFT',
          note: null,
          wasPrinted: false,
          printCount: 0,
          printFailed: false,
          sessionVoidNo: 1,
          approvalId: null,
        }),
      }),
    );
    expect(res.body.data.void.minutesAfterPost).toBeGreaterThanOrEqual(0);
    expect(res.body.data.void.postedOn).not.toBeNull();

    const row = await prisma.tillVoid.findFirstOrThrow({ where: { tvdSrcDocId: unprinted.sbId } });
    expect(row).toEqual(
      expect.objectContaining({
        tvdSrcDocType: 'SALE_BILL',
        tvdAccYear: ACC_YEAR,
        tvdSessionId: session.tssId,
        tvdDeviceId: deviceId,
        tvdWasPrinted: false,
        tvdSessionVoidNo: 1,
        tvdReversalAccYear: ACC_YEAR,
      }),
    );
    expect(row.tvdReversalVoucherId).not.toBeNull();
    // The reversal is the cancel's: the bill's posted voucher names it.
    const [orig] = await prisma.$queryRaw<{ rev: string | null }[]>`
      SELECT h.avh_reversal_voucher_id::text AS rev
        FROM sales.sale_bill b
        JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = b.sb_posted_voucher_id AND h.avh_acc_year = b.sb_acc_year
       WHERE b.sb_id = ${unprinted.sbId}::uuid AND b.sb_acc_year = ${ACC_YEAR}`;
    expect(orig.rev).toBe(row.tvdReversalVoucherId);
    const [bill] = await prisma.$queryRaw<{ s: string }[]>`
      SELECT sb_status AS s FROM sales.sale_bill WHERE sb_id = ${unprinted.sbId}::uuid AND sb_acc_year = ${ACC_YEAR}`;
    expect(bill.s).toBe('CANCELLED');

    const events = await prisma.tillEvent.findMany({
      where: { tevSessionId: session.tssId, tevEventCode: 'BILL_VOID' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        tevSrcDocType: 'SALE_BILL',
        tevSrcDocId: unprinted.sbId,
        tevCounterId: counterId,
        tevUserId: ACTOR,
        tevReasonId: reasonOf('CUST_LEFT').reasonId,
      }),
    );
    expect(Number(events[0].tevAmount)).toBe(unprinted.amount);
    expect(events[0].tevPayload).toEqual(
      expect.objectContaining({
        printed: false,
        voidNo: 1,
        reason: 'CUST_LEFT',
        cash: unprinted.amount,
      }),
    );

    // Idempotent: the same answer, no second row, no second event.
    const again = await post('bills/void', {
      ...billKeys(unprinted.sbId),
      reasonId: reasonOf('CUST_LEFT').reasonId,
    });
    expectStatus(again, 201);
    expect(again.body.data.void.tvdId).toBe(row.tvdId);
    expect(await prisma.tillVoid.count({ where: { tvdSrcDocId: unprinted.sbId } })).toBe(1);
    expect(
      await prisma.tillEvent.count({
        where: { tevSessionId: session.tssId, tevEventCode: 'BILL_VOID' },
      }),
    ).toBe(1);

    const check = await get('bills/void-check', billKeys(unprinted.sbId));
    expectStatus(check, 200);
    expect(check.body.data).toEqual(
      expect.objectContaining({
        route: 'VOIDED',
        canVoid: false,
        void: expect.objectContaining({ tvdId: row.tvdId }),
      }),
    );
  });

  it('a bill printed before the void is stored AFTER PRINT: print_log read at the moment of the void (prints, last, a FAILED one)', async () => {
    printed = await postCashBill('B', 1);
    const [tpl] = await prisma.$queryRaw<{ ptv_id: string; ptv_template_id: string }[]>`
      SELECT ptv_id, ptv_template_id FROM public.print_template_version LIMIT 1`;
    const log = (status: string, mode: string, minutesAgo: number, copy = 1) => prisma.$executeRaw`
      INSERT INTO public.print_log (plg_acc_year, plg_company_id, plg_branch_id, plg_device_id, plg_src_module, plg_src_doc_type,
                                    plg_src_doc_id, plg_src_acc_year, plg_purpose_id, plg_template_id, plg_version_id,
                                    plg_output_mode, plg_copy_no, plg_status, plg_error, plg_printed_on, plg_printed_by)
      VALUES (${ACC_YEAR}, ${COMPANY}::uuid, ${BRANCH}::uuid, ${deviceId}::uuid, 'SALES', 'SALE_BILL',
              ${printed.sbId}::uuid, ${ACC_YEAR}, ${SALE_INVOICE_PURPOSE}::uuid, ${tpl.ptv_template_id}::uuid, ${tpl.ptv_id}::uuid,
              ${mode}, ${copy}, ${status}, ${status === 'FAILED' ? 'e2e: printer offline' : null},
              now() - make_interval(mins => ${minutesAgo}::int), ${ACTOR}::uuid)`;
    await log('FAILED', 'PRINT', 3);
    await log('SUCCESS', 'PRINT', 2);
    await log('SUCCESS', 'REPRINT', 1);
    await log('SUCCESS', 'PREVIEW', 1); // a preview is not a print

    const check = await get('bills/void-check', billKeys(printed.sbId));
    expectStatus(check, 200);
    expect(check.body.data).toEqual(
      expect.objectContaining({
        route: 'VOID',
        printed: true,
        printCount: 2,
        printFailed: true,
        nextVoidNo: 2,
      }),
    );
    expect(check.body.data.prints).toHaveLength(3);

    const res = await post('bills/void', {
      ...billKeys(printed.sbId),
      reasonId: reasonOf('PRINTER_FAIL').reasonId,
      note: 'said the printer jammed',
    });
    expectStatus(res, 201);
    expect(res.body.data.void).toEqual(
      expect.objectContaining({
        wasPrinted: true,
        printCount: 2,
        printFailed: true,
        sessionVoidNo: 2,
        reasonCode: 'PRINTER_FAIL',
        note: 'said the printer jammed',
      }),
    );
    expect(res.body.data.void.lastPrintedOn).not.toBeNull();
    const row = await prisma.tillVoid.findFirstOrThrow({ where: { tvdSrcDocId: printed.sbId } });
    expect(row.tvdWasPrinted).toBe(true);
    expect(row.tvdPrintCount).toBe(2);
    expect(row.tvdLastPrintedOn).not.toBeNull();
    // The audit row and the status log say "voided" with the reason's text.
    const [log1] = await prisma.$queryRaw<{ remarks: string }[]>`
      SELECT tsl_remarks AS remarks FROM public.txn_status_log
       WHERE tsl_src_doc_type = 'SALE_BILL' AND tsl_src_doc_id = ${printed.sbId}::uuid AND tsl_event = 'CANCELLED'`;
    expect(log1.remarks).toBe('Printer failure — said the printer jammed');
  });

  it('the Z header carries the void figures', async () => {
    const header = await (app.get(TillSessionHeaderProvider) as PrintDataProvider).resolve({
      context: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: session.tssAccYear,
        docId: session.tssId,
        userId: ACTOR,
        deviceId,
      },
      params: {},
      lang: 'en',
      rowLimit: 1000,
    } as never);
    const row = (Array.isArray(header) ? header[0] : header) as Record<string, unknown>;
    expect(row).toEqual(
      expect.objectContaining({
        void_count: 2,
        void_amount: Math.round((unprinted.amount + printed.amount) * 100) / 100,
        void_printed_count: 1,
        line_void_count: 0,
        line_void_value: 0,
      }),
    );
  });

  it('LINE_VOID is a device fact events/batch accepts (re-sent: a no-op); BILL_VOID from a device is still refused', async () => {
    const seq = Date.now();
    const batch = {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      events: [
        {
          code: 'LINE_VOID',
          eventOn: new Date().toISOString(),
          clientSeq: seq,
          sessionId: session.tssId,
          amount: 118,
          payload: {
            docId: null,
            itemId: item.itemId,
            itemName: 'E2E',
            qtyBefore: 2,
            qtyAfter: 1,
            rate: 100,
            value: 118,
            wasPrinted: false,
            lineAgeSeconds: 12,
          },
        },
      ],
    };
    const res = await post('till/events/batch', batch);
    expectStatus(res, 200);
    expect(res.body.data).toEqual(expect.objectContaining({ accepted: 1, duplicates: 0 }));
    const again = await post('till/events/batch', batch);
    expectStatus(again, 200);
    expect(again.body.data).toEqual(expect.objectContaining({ accepted: 0, duplicates: 1 }));

    const forged = await post('till/events/batch', {
      ...batch,
      events: [
        {
          code: 'BILL_VOID',
          eventOn: new Date().toISOString(),
          clientSeq: seq + 1,
          sessionId: session.tssId,
        },
      ],
    });
    expectStatus(forged, 422);
    expect(forged.body.errors[0].code).toBe('TILL_EVENT_INVALID');

    const header = await (app.get(TillSessionHeaderProvider) as PrintDataProvider).resolve({
      context: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: session.tssAccYear,
        docId: session.tssId,
        userId: ACTOR,
        deviceId,
      },
      params: {},
      lang: 'en',
      rowLimit: 1000,
    } as never);
    const row = (Array.isArray(header) ? header[0] : header) as Record<string, unknown>;
    expect(row).toEqual(expect.objectContaining({ line_void_count: 1, line_void_value: 118 }));
  });

  it('a company that switches VOID_BILL to ALWAYS under a REFUSE gate gets 428; the bill stays POSTED', async () => {
    const third = await postCashBill('C', 1);
    const [rule] = await prisma.$queryRaw<{ tar_id: string }[]>`
      INSERT INTO accounts.till_approval_rule
          (tar_company_id, tar_branch_id, tar_event_code, tar_mode, tar_channel, tar_min_role, tar_blocks_till, tar_remarks, tar_created_by)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, 'VOID_BILL', 'ALWAYS', 'COUNTER', 'SUPERVISOR', true, 'e2e void', 'e2e-void')
      RETURNING tar_id`;
    ruleId = rule.tar_id;
    await prisma.$executeRaw`
      INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_branch_id, asv_value, asv_created_by)
      VALUES ('till.approval_gate', 'BRANCH', ${BRANCH}::uuid, 'REFUSE', 'e2e-void')`;
    try {
      const res = await post('bills/void', {
        ...billKeys(third.sbId),
        reasonId: reasonOf('CUST_LEFT').reasonId,
      });
      expectStatus(res, 428);
      expect(res.body.errors[0]).toEqual(
        expect.objectContaining({
          code: 'TILL_APPROVAL_REQUIRED',
          event: 'VOID_BILL',
          srcDocType: 'SALE_BILL',
          srcDocId: third.sbId,
          requiredRole: 'SUPERVISOR',
        }),
      );
      const [bill] = await prisma.$queryRaw<{ s: string }[]>`
        SELECT sb_status AS s FROM sales.sale_bill WHERE sb_id = ${third.sbId}::uuid AND sb_acc_year = ${ACC_YEAR}`;
      expect(bill.s).toBe('POSTED');
      expect(await prisma.tillVoid.count({ where: { tvdSrcDocId: third.sbId } })).toBe(0);

      // OVER_COUNT: two voids already in the session, a threshold of 2 asks on this third one.
      await prisma.$executeRaw`UPDATE accounts.till_approval_rule SET tar_mode = 'OVER_COUNT', tar_threshold_count = 2 WHERE tar_id = ${ruleId}::uuid`;
      const over = await post('bills/void', {
        ...billKeys(third.sbId),
        reasonId: reasonOf('CUST_LEFT').reasonId,
      });
      expectStatus(over, 428);
      await prisma.$executeRaw`UPDATE accounts.till_approval_rule SET tar_threshold_count = 3 WHERE tar_id = ${ruleId}::uuid`;
      const under = await post('bills/void', {
        ...billKeys(third.sbId),
        reasonId: reasonOf('CUST_LEFT').reasonId,
      });
      expectStatus(under, 201);
      expect(under.body.data.void).toEqual(
        expect.objectContaining({ sessionVoidNo: 3, approvalId: null }),
      );
    } finally {
      await prisma.$executeRaw`DELETE FROM accounts.till_approval_rule WHERE tar_id = ${ruleId}::uuid`;
      ruleId = null;
      await prisma.$executeRaw`
        DELETE FROM public.app_setting_value
         WHERE asv_setting_key = 'till.approval_gate' AND asv_branch_id = ${BRANCH}::uuid AND asv_created_by = 'e2e-void'`;
    }
  });

  it('the drawer no longer expects the voided cash; once counted, the bill’s door is a sale return', async () => {
    const kept = await postCashBill('D', 1);
    expectStatus(await post('till/sessions/end-billing', key()), 200);
    const check = await get('bills/void-check', billKeys(kept.sbId));
    expectStatus(check, 200);
    expect(check.body.data).toEqual(
      expect.objectContaining({
        route: 'RETURN',
        code: 'TILL_VOID_SESSION_CLOSED',
        canVoid: false,
      }),
    );
    const refused = await post('bills/void', {
      ...billKeys(kept.sbId),
      reasonId: reasonOf('CUST_LEFT').reasonId,
    });
    expectStatus(refused, 409);
    expect(refused.body.errors[0].code).toBe('TILL_VOID_SESSION_CLOSED');
    // And the D7 cancel rule still stands behind it.
    const cancel = await post('bills/cancel', {
      ...billKeys(kept.sbId),
      reason: 'after the count began',
    });
    expectStatus(cancel, 409);
    expect(cancel.body.errors[0].code).toBe('TILL_SESSION_CLOSED_USE_RETURN');

    const count = await post('till/sessions/count', {
      ...key(),
      lines: [
        { tenderTypeId: 1, denominationId: note500, qty: 2 },
        { tenderTypeId: 1, enteredAmount: kept.amount },
      ],
    });
    expectStatus(count, 200);
    expect(count.body.data.outcome).toBe('ACCEPTED');
    const close = await post('till/sessions/close', { ...key(), floatLeft: 0 });
    expectStatus(close, 200);
    // Four bills posted, three voided: the float and the kept bill's cash only.
    expect(
      close.body.data.tenders.find((t: { tenderTypeId: number }) => t.tenderTypeId === 1),
    ).toEqual(
      expect.objectContaining({
        openAmount: 1000,
        salesAmount: kept.amount,
        expected: 1000 + kept.amount,
      }),
    );
  });
});
