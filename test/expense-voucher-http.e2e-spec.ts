import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { as, bootIdentityApp, TESTER } from './helpers/identity-app';
import {
  grantMenuRights,
  PAYMENT_MENU,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import {
  ACC_YEAR,
  BRANCH,
  COMPANY,
  draftBody,
  expectStatus,
  keys as paymentKeys,
  PaymentFixtures,
  prisma,
} from './helpers/payment-e2e';
import { EXPENSE_PRINT_PURPOSE_CODE } from '../src/modules/accountsModule/expense/types/expense-enum';

/**
 * The expense voucher (ExpV, /expenses/*) and the money documents of a till
 * session — till/plan-till-receipt-payment-expense.md, over HTTP against the
 * dev database.
 *
 *   §4     draft → validate (every refusal at once) → post → cancel; GST bill
 *          (input tax legs, the GSTR-2 row; a line with no ITC carries its tax)
 *   §2.1   a card expense in a session is "paid from bank": never in the card
 *          slip count
 *   §2.2   a journal on the till cash ledger from a device in session is refused
 *   §2.3   back-office cash in a till branch comes from the safe (or is refused
 *          under REFUSE); a cancel after the drawer stops taking money is refused
 *   §3.4   40A(3): a payment and an expense to one supplier on one day are
 *          summed, and WARN above the limit — they still post
 *   §3.3 / §4.3  CASH_PAYMENT / EXPENSE rules: the need is reported, never
 *          enforced (phase 3 builds the gate)
 *   §4.4   the list grid and the print purpose
 *
 * One app plays every login (helpers/identity-app.ts). The suite owns its
 * devices, ledgers, counter, safe and session, and removes them and every
 * voucher it wrote.
 *
 *     npm run test:e2e -- expense-voucher-http --runInBand
 */

jest.setTimeout(240_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282];
const EXPENSE_MENU = 277;
const JOURNAL_MENU = 103;
const TENDER = {
  CASH: { id: '019fbbd0-9a8e-73db-b762-175dda2e1762', type: 1 },
  CARD: { id: '019fcbba-bc84-73c1-a273-ff8a55ae2b23', type: 2 },
  BANK: { id: '019fcbbd-aaa5-7df3-9b47-b95a06bcc1db', type: 6 },
};
const CASH_LEDGER = '019ef844-efba-755d-ab5d-b4d7281edf19'; // Cash In Hand — the till cash ledger
const GST18 = '01a090cd-4a59-71c8-b844-cc2fb2741293';
const INDIRECT_EXPENSES = '019eee86-f34b-7ec8-813f-df893287fb9c';
const SUNDRY_CREDITORS = '019eee86-f34b-7d73-8a79-f5c6f036439a';

const tag = Date.now().toString(36).toUpperCase().slice(-6);
const today = new Date().toISOString().slice(0, 10);
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
let tillPc: string;
let officePc: string;
let expenseLedger: string;
let supplier: string;
let counterId: string;
let safeId: string;
let safeLedger: string;
let session: { tssId: string; tssAccYear: string; tssDayId: string };
let dayCreated = false;
const vouchers: string[] = [];
let drawerExpense: string;
let backOfficeExpense: string;
/** Payment parties (menu 100): torn down with every voucher naming them, expenses included. */
const payments = new PaymentFixtures();

const http = () => request(app.getHttpServer());
const postAs = (device: string, path: string, body: object, who = 'tester1') =>
  http().post(`/api/v1/${path}`).set('Authorization', as(who, device)).send(body);
const getAs = (device: string, path: string, query: object, who = 'tester1') =>
  http().get(`/api/v1/${path}`).set('Authorization', as(who, device)).query(query);
const codes = (res: request.Response): string[] =>
  (res.body.errors ?? []).map((e: { code?: string }) => e.code);
const key = (voucherId: string) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  accYear: ACC_YEAR,
  voucherId,
});

function body(over: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY,
    branchId: BRANCH,
    accYear: ACC_YEAR,
    voucherDate: today,
    remarks: `E2E-EXP-${tag}`,
    lines: [{ rowNo: 1, ledgerId: expenseLedger, amount: 250, description: 'Tea' }],
    tenders: [
      { tdRowNo: 1, tdTenderId: TENDER.CASH.id, tdTenderTypeId: TENDER.CASH.type, tdAmount: 250 },
    ],
    ...over,
  };
}

/** Draft then post, from a device; the voucher id is kept for teardown. */
async function createAndPost(device: string, over: Record<string, unknown> = {}) {
  const created = await postAs(device, 'expenses/create', body(over));
  expectStatus(created, 201);
  const voucherId = created.body.data.voucherId as string;
  vouchers.push(voucherId);
  return { voucherId, posted: await postAs(device, 'expenses/post', key(voucherId)) };
}

/** A cash payment on account (menu 100), draft then post, from a device. */
async function payCash(device: string, partyId: string, amount: number) {
  const draft = await postAs(
    device,
    'payments/create',
    draftBody(partyId, [
      {
        tdRowNo: 1,
        tdTenderId: TENDER.CASH.id,
        tdTenderTypeId: TENDER.CASH.type,
        tdAmount: amount,
      },
    ]),
  );
  expectStatus(draft, 201);
  const voucherId = draft.body.data.header.avhVoucherId as string;
  payments.vouchers.push(voucherId);
  return postAs(device, 'payments/post', {
    ...paymentKeys(voucherId),
    allocations: [],
    onAccount: amount,
  });
}

const warningCodes = (warnings: { code: string }[] | undefined): string[] =>
  (warnings ?? []).map((w) => w.code);

async function legsOf(voucherId: string) {
  return prisma.$queryRaw<{ dr_cr: string; ledger: string; amount: string }[]>`
    SELECT trim(av_dr_cr) AS dr_cr, av_ledger_id::text AS ledger, av_amount::text AS amount
      FROM accounts.acc_vouchers
     WHERE av_voucher_id = ${voucherId}::uuid AND av_is_deleted = false
     ORDER BY av_row_no`;
}

beforeAll(async () => {
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-exp-${tag}-${name}`}, ${`E2E ${name}`}, 'Desktop')
      RETURNING dev_id::text`;
    return row.dev_id;
  };
  tillPc = await device('till');
  officePc = await device('office');
  expenseLedger = (
    await prisma.accLedgerMaster.create({
      data: {
        ledName: `E2E-EXP-${tag} Staff Tea`,
        ledGroupId: INDIRECT_EXPENSES,
        ledCompanyId: COMPANY,
      },
    })
  ).ledId;
  supplier = (
    await prisma.accLedgerMaster.create({
      data: {
        ledName: `E2E-EXP-${tag} Supplier`,
        ledGroupId: SUNDRY_CREDITORS,
        ledCompanyId: COMPANY,
        ledLedgerType: 'PARTY',
      },
    })
  ).ledId;
  const [day] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid AND tbd_is_deleted = false`;
  dayCreated = day.n === 0;

  rights.push(
    await grantMenuRights(
      prisma,
      [...TILL_MENUS, EXPENSE_MENU, JOURNAL_MENU, PAYMENT_MENU],
      TESTER1,
    ),
  );
  rights.push(await grantMenuRights(prisma, TILL_MENUS, TESTER));
  app = await bootIdentityApp();

  const safe = await postAs(officePc, 'till/safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2EX${tag}`,
    tsfName: 'E2E expense safe',
    tsfIsDefault: true,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  safeLedger = safe.body.data.tsfLedgerId;
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`E2EX${tag}`}, 'E2E expense counter', ${tillPc}::uuid, ${safeId}::uuid, 'e2e-expense')
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;
  const open = await postAs(tillPc, 'till/sessions/open', {
    companyId: COMPANY,
    branchId: BRANCH,
    floatMode: 'NONE',
    lines: [],
  });
  expectStatus(open, 201);
  session = open.body.data;
});

afterAll(async () => {
  await payments.teardown();
  const ids = vouchers;
  if (ids.length) {
    const mirrors = await prisma.$queryRaw<{ id: string }[]>`
      SELECT avh_voucher_id::text AS id FROM accounts.acc_voucher_header WHERE avh_against_voucher_id = ANY(${ids}::uuid[])`;
    const all = [...ids, ...mirrors.map((m) => m.id)];
    await prisma.$executeRaw`
      DELETE FROM accounts.acc_voucher_doc_detail WHERE vtx_gdr_id IN (
        SELECT gdr_id FROM accounts.acc_voucher_doc_register WHERE gdr_voucher_id = ANY(${ids}::uuid[]))`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_doc_register WHERE gdr_voucher_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_tender_detail WHERE td_src_doc_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM public.txn_status_log WHERE tsl_src_doc_id = ANY(${all}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_src_doc_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`
      UPDATE accounts.acc_voucher_header SET avh_reversal_voucher_id = NULL, avh_reversal_acc_year = NULL
       WHERE avh_voucher_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id = ANY(${all}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ANY(${mirrors.map((m) => m.id)}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ANY(${ids}::uuid[])`;
  }
  if (session) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_id = ${session.tssId}::uuid`;
    if (dayCreated) {
      await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_day_id = ${session.tssDayId}::uuid`;
      await prisma.$executeRaw`
        DELETE FROM accounts.till_business_day d WHERE d.tbd_id = ${session.tssDayId}::uuid
           AND NOT EXISTS (SELECT 1 FROM accounts.till_session s WHERE s.tss_day_id = d.tbd_id)`;
    }
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_device_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counterId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_id = ${safeId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM public.app_setting_value WHERE asv_created_by = 'e2e-expense'`;
  await prisma.$executeRaw`DELETE FROM accounts.acc_ledger_master WHERE led_id IN (${expenseLedger ?? null}::uuid, ${supplier ?? null}::uuid)`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  for (const memo of rights.reverse()) {
    await restoreMenuRights(prisma, memo);
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('Pickers', () => {
  it('ledger-pick offers the expense ledger, never the supplier; quick-reasons lists the EXPENSE reasons', async () => {
    const pick = await getAs(officePc, 'expenses/ledger-pick', {
      companyId: COMPANY,
      search: `E2E-EXP-${tag}`,
    });
    expectStatus(pick, 200);
    expect(pick.body.data.map((l: { ledgerId: string }) => l.ledgerId)).toEqual([expenseLedger]);
    const reasons = await getAs(officePc, 'expenses/quick-reasons', { companyId: COMPANY });
    expectStatus(reasons, 200);
    expect(reasons.body.data.length).toBeGreaterThan(0);
  });
});

describe('Validate', () => {
  it('collects every refusal at once, with HTTP 200', async () => {
    const res = await postAs(
      officePc,
      'expenses/validate',
      body({
        lines: [{ rowNo: 1, ledgerId: supplier, amount: 100 }],
        tenders: [
          {
            tdRowNo: 1,
            tdTenderId: TENDER.BANK.id,
            tdTenderTypeId: TENDER.BANK.type,
            tdAmount: 90,
          },
        ],
      }),
    );
    expectStatus(res, 200);
    expect(res.body.data.ok).toBe(false);
    expect(res.body.data.refusals.map((r: { code: string }) => r.code).sort()).toEqual([
      'EXPENSE_LEDGER_NOT_EXPENSE',
      'EXPENSE_TOTAL_MISMATCH',
    ]);
    const gst = await postAs(
      officePc,
      'expenses/validate',
      body({ gstBill: { invoiceNo: 'X1', invoiceDate: today } }),
    );
    expect(gst.body.data.refusals.map((r: { code: string }) => r.code)).toContain(
      'EXPENSE_GST_INCOMPLETE',
    );
  });
});

describe('§2.3 · back-office cash in a branch that runs a till', () => {
  it('comes from the default safe: the CR leg and the tender row name the safe’s ledger', async () => {
    const { voucherId, posted } = await createAndPost(officePc);
    expectStatus(posted, 201);
    backOfficeExpense = voucherId;
    expect(posted.body.data.status).toBe('POSTED');
    expect(posted.body.data.voucherNo).toMatch(/^exp/i);
    expect(posted.body.data.derived.tenders[0].moneyFrom).toBe('SAFE');
    // The saved voucher names the safe, as /validate does (notes 99 §6).
    expect(posted.body.data.derived.safeName).toBe('E2E expense safe');
    expect(await legsOf(voucherId)).toEqual([
      { dr_cr: 'DR', ledger: expenseLedger, amount: '250.00' },
      { dr_cr: 'CR', ledger: safeLedger, amount: '250.00' },
    ]);
    const [row] = await prisma.$queryRaw<{ l: string; v: string | null; s: string | null }[]>`
      SELECT td_tender_ledger_id::text AS l, td_voucher_id::text AS v, td_session_id::text AS s
        FROM accounts.acc_tender_detail WHERE td_src_doc_id = ${voucherId}::uuid AND td_src_doc_type = 'EXPENSE'`;
    expect(row).toEqual({ l: safeLedger, v: voucherId, s: null });
  });

  it('is refused under till.backoffice_cash_from = REFUSE (TILL_SESSION_REQUIRED)', async () => {
    await prisma.$executeRaw`
      INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_branch_id, asv_value, asv_created_by)
      VALUES ('till.backoffice_cash_from', 'BRANCH', ${BRANCH}::uuid, 'REFUSE', 'e2e-expense')`;
    try {
      const { posted } = await createAndPost(officePc);
      expectStatus(posted, 409);
      expect(codes(posted)).toEqual(['TILL_SESSION_REQUIRED']);
    } finally {
      await prisma.$executeRaw`DELETE FROM public.app_setting_value WHERE asv_created_by = 'e2e-expense'`;
    }
  });
});

describe('§2.1 / §3 · on a till device in session', () => {
  it('cash is the drawer and the card is "paid from bank": the session expects the cash, never the card', async () => {
    const check = await postAs(
      tillPc,
      'expenses/validate',
      body({
        lines: [{ rowNo: 1, ledgerId: expenseLedger, amount: 500 }],
        tenders: [
          {
            tdRowNo: 1,
            tdTenderId: TENDER.CASH.id,
            tdTenderTypeId: TENDER.CASH.type,
            tdAmount: 300,
          },
          {
            tdRowNo: 2,
            tdTenderId: TENDER.CARD.id,
            tdTenderTypeId: TENDER.CARD.type,
            tdAmount: 200,
          },
        ],
      }),
    );
    expectStatus(check, 200);
    expect(check.body.data.derived.session).toEqual(
      expect.objectContaining({ sessionId: session.tssId }),
    );

    const { voucherId, posted } = await createAndPost(tillPc, {
      lines: [{ rowNo: 1, ledgerId: expenseLedger, amount: 500 }],
      tenders: [
        { tdRowNo: 1, tdTenderId: TENDER.CASH.id, tdTenderTypeId: TENDER.CASH.type, tdAmount: 300 },
        { tdRowNo: 2, tdTenderId: TENDER.CARD.id, tdTenderTypeId: TENDER.CARD.type, tdAmount: 200 },
      ],
    });
    expectStatus(posted, 201);
    drawerExpense = voucherId;
    expect(posted.body.data.sessionId).toBe(session.tssId);
    expect(posted.body.data.derived.tenders.map((t: { moneyFrom: string }) => t.moneyFrom)).toEqual(
      ['DRAWER', 'LEDGER'],
    );
    const rows = await prisma.$queryRaw<{ s: string | null }[]>`
      SELECT td_session_id::text AS s FROM accounts.acc_tender_detail
       WHERE td_src_doc_id = ${voucherId}::uuid AND td_is_deleted = false`;
    expect(rows.map((r) => r.s)).toEqual([session.tssId, session.tssId]);
    expect(
      await prisma.tillEvent.count({
        where: { tevEventCode: 'EXPENSE_POSTED', tevSrcDocId: voucherId },
      }),
    ).toBe(1);

    // The supervisor sees the expectation (Till Sessions, 273 OVERRIDE).
    const seen = await getAs(
      tillPc,
      'till/sessions/get',
      { companyId: COMPANY, branchId: BRANCH, accYear: session.tssAccYear, tssId: session.tssId },
      'tester',
    );
    expectStatus(seen, 200);
    const tenders = seen.body.data.tenders as {
      tenderTypeId: number;
      expenseAmount: number;
      paidFromBank: number;
      expected: number;
    }[];
    expect(tenders.find((t) => t.tenderTypeId === 1)).toEqual(
      expect.objectContaining({ expenseAmount: 300, expected: -300 }),
    );
    expect(tenders.find((t) => t.tenderTypeId === 2)).toEqual(
      expect.objectContaining({ expenseAmount: 0, paidFromBank: 200, expected: 0 }),
    );
  });

  it('§2.2 · a journal on the till cash ledger is TILL_CASH_LEDGER_DIRECT', async () => {
    const res = await postAs(tillPc, 'vouchers/post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'Jrl',
        date: today,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: expenseLedger, amount: 10 },
        { rowNo: 2, drCr: 'CR', ledgerId: CASH_LEDGER, amount: 10 },
      ],
    });
    expectStatus(res, 409);
    expect(codes(res)).toEqual(['TILL_CASH_LEDGER_DIRECT']);
  });
});

describe('§3.4 · 40A(3) — cash to one payee in a day', () => {
  it('sums a payment and an expense to one supplier: above 10,000 they WARN, and still post', async () => {
    const payee = await payments.createParty(`EXP40A-${tag}`);
    // 6,000 cash on account from the back office (the safe): alone, under the limit.
    const paid = await payCash(officePc, payee, 6000);
    expectStatus(paid, 201);
    expect(warningCodes(paid.body.data.warnings)).toEqual([]);
    expect(paid.body.data.approval).toBeNull();

    // 5,000 more the same day, on an expense naming the supplier: 11,000.
    const over = {
      partyId: payee,
      lines: [{ rowNo: 1, ledgerId: expenseLedger, amount: 5000, description: 'Loading' }],
      tenders: [
        {
          tdRowNo: 1,
          tdTenderId: TENDER.CASH.id,
          tdTenderTypeId: TENDER.CASH.type,
          tdAmount: 5000,
        },
      ],
    };
    const check = await postAs(officePc, 'expenses/validate', body(over));
    expectStatus(check, 200);
    expect(check.body.data.ok).toBe(true);
    const hit = (
      check.body.data.warnings as { code: string; level: string; message: string }[]
    ).find((w) => w.code === 'STATUTORY_40A3');
    expect(hit).toEqual(expect.objectContaining({ level: 'WARN', field: 'tenders' }));
    expect(hit!.message).toContain('11000.00');
    expect(hit!.message).toContain('6000.00');

    const { posted } = await createAndPost(officePc, over);
    expectStatus(posted, 201);
    expect(warningCodes(posted.body.data.warnings)).toContain('STATUTORY_40A3');

    // A card / bank expense to the same supplier is not cash: no 40A(3).
    const byBank = await postAs(
      officePc,
      'expenses/validate',
      body({
        ...over,
        tenders: [
          {
            tdRowNo: 1,
            tdTenderId: TENDER.BANK.id,
            tdTenderTypeId: TENDER.BANK.type,
            tdAmount: 5000,
          },
        ],
      }),
    );
    expect(warningCodes(byBank.body.data.warnings)).not.toContain('STATUTORY_40A3');
  });

  it('with no supplier named, judges the voucher’s own cash alone', async () => {
    const cash = (amount: number) =>
      postAs(
        officePc,
        'expenses/validate',
        body({
          lines: [{ rowNo: 1, ledgerId: expenseLedger, amount }],
          tenders: [
            {
              tdRowNo: 1,
              tdTenderId: TENDER.CASH.id,
              tdTenderTypeId: TENDER.CASH.type,
              tdAmount: amount,
            },
          ],
        }),
      );
    expect(warningCodes((await cash(10500)).body.data.warnings)).toContain('STATUTORY_40A3');
    expect(warningCodes((await cash(10000)).body.data.warnings)).not.toContain('STATUTORY_40A3');
  });
});

describe('§3.3 / §4.3 · approval rules — reported until phase 3, never enforced', () => {
  it('EXPENSE: above 500 at a till the need is reported; the back office has none', async () => {
    const over = {
      lines: [{ rowNo: 1, ledgerId: expenseLedger, amount: 600 }],
      tenders: [
        { tdRowNo: 1, tdTenderId: TENDER.CASH.id, tdTenderTypeId: TENDER.CASH.type, tdAmount: 600 },
      ],
    };
    const atTill = await postAs(tillPc, 'expenses/validate', body(over));
    expectStatus(atTill, 200);
    expect(atTill.body.data.ok).toBe(true);
    expect(atTill.body.data.approval).toEqual(
      expect.objectContaining({
        event: 'EXPENSE',
        threshold: 500,
        amount: 600,
        minRole: 'SUPERVISOR',
        enforced: false,
      }),
    );
    expect(atTill.body.data.warnings).toContainEqual(
      expect.objectContaining({ code: 'TILL_APPROVAL_REQUIRED', level: 'INFO' }),
    );
    const atOffice = await postAs(officePc, 'expenses/validate', body(over));
    expect(atOffice.body.data.approval).toBeNull();

    const { voucherId, posted } = await createAndPost(tillPc, over);
    expectStatus(posted, 201);
    expect(posted.body.data.approval).toEqual(expect.objectContaining({ event: 'EXPENSE' }));
    const [event] = await prisma.$queryRaw<{ event: string | null }[]>`
      SELECT tev_payload->'approval'->>'event' AS event FROM accounts.till_event
       WHERE tev_event_code = 'EXPENSE_POSTED' AND tev_src_doc_id = ${voucherId}::uuid`;
    expect(event.event).toBe('EXPENSE');
  });

  it('CASH_PAYMENT: a cash payment of 1,500 out of the drawer posts, the need on its record', async () => {
    const payee = await payments.createParty(`EXPCP-${tag}`);
    const paid = await payCash(tillPc, payee, 1500);
    expectStatus(paid, 201);
    expect(paid.body.data.approval).toEqual(
      expect.objectContaining({
        event: 'CASH_PAYMENT',
        threshold: 1000,
        amount: 1500,
        enforced: false,
      }),
    );
    expect(paid.body.data.warnings).toContainEqual(
      expect.objectContaining({ code: 'TILL_APPROVAL_REQUIRED', level: 'INFO' }),
    );
    const voucherId = paid.body.data.header.avhVoucherId as string;
    const [event] = await prisma.$queryRaw<{ event: string | null; session: string | null }[]>`
      SELECT tev_payload->'approval'->>'event' AS event, tev_session_id::text AS session
        FROM accounts.till_event
       WHERE tev_event_code = 'PAYMENT_POSTED' AND tev_src_doc_id = ${voucherId}::uuid`;
    expect(event).toEqual({ event: 'CASH_PAYMENT', session: session.tssId });
  });
});

describe('§4.3 · a GST bill', () => {
  it('posts input tax for the eligible line, puts the ineligible line’s tax in its cost, and files GSTR-2', async () => {
    const { voucherId, posted } = await createAndPost(officePc, {
      partyId: supplier,
      gstBill: { supplierGstin: '33ABCDE1234F1Z5', invoiceNo: `E2E-${tag}`, invoiceDate: today },
      lines: [
        { rowNo: 1, ledgerId: expenseLedger, amount: 1000, taxId: GST18, hsn: '998533' },
        { rowNo: 2, ledgerId: expenseLedger, amount: 100, taxId: GST18, itc: false },
      ],
      tenders: [
        {
          tdRowNo: 1,
          tdTenderId: TENDER.BANK.id,
          tdTenderTypeId: TENDER.BANK.type,
          tdAmount: 1298,
        },
      ],
    });
    expectStatus(posted, 201);
    const d = posted.body.data.derived;
    expect(d).toEqual(
      expect.objectContaining({
        total: 1298,
        taxable: 1100,
        supplyNature: 'INTRA',
        tax: { cgst: 99, sgst: 99, igst: 0, cess: 0 },
      }),
    );
    const legs = await legsOf(voucherId);
    expect(legs.map((l) => `${l.dr_cr} ${l.amount}`)).toEqual([
      'DR 1000.00',
      'DR 118.00',
      'DR 90.00',
      'DR 90.00',
      'CR 1298.00',
    ]);
    const [reg] = await prisma.$queryRaw<{ party: string; no: string; status: string }[]>`
      SELECT gdr_party_id::text AS party, gdr_doc_no AS no, gdr_doc_status::text AS status
        FROM accounts.acc_voucher_doc_register WHERE gdr_voucher_id = ${voucherId}::uuid`;
    expect(reg).toEqual({ party: supplier, no: `E2E-${tag}`, status: expect.any(String) });

    const cancelled = await postAs(officePc, 'expenses/cancel', {
      ...key(voucherId),
      reason: 'e2e',
    });
    expectStatus(cancelled, 200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(cancelled.body.data.reversalVoucherId).toBeTruthy();
    const [after] = await prisma.$queryRaw<{ status: string }[]>`
      SELECT gdr_doc_status::text AS status FROM accounts.acc_voucher_doc_register
       WHERE gdr_voucher_id = ${voucherId}::uuid`;
    expect(after.status).toBe('CANCELED');
  });
});

describe('§4.4 · the list and the print purpose', () => {
  it('grid MAIN LIST - EXPENSE VOUCHERS shows the drawer expense: heads, tenders, session', async () => {
    const [grid] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT grid_id::text AS id FROM fixed.grid_details
       WHERE grid_name = 'MAIN LIST - EXPENSE VOUCHERS' AND grid_is_deleted = false`;
    const res = await getAs(tillPc, 'configured-grid-sql/run', {
      grid_id: grid.id,
      limit: '100',
      search: `E2E-EXP-${tag}`,
      grid_param: JSON.stringify({
        iavh_company_id: COMPANY,
        iavh_branch_id: BRANCH,
        iavh_acc_year: ACC_YEAR,
        iavh_status: 'POSTED',
        ifrom_date: today,
        ito_date: today,
      }),
    });
    expectStatus(res, 200);
    const row = (res.body.data.items as Record<string, unknown>[]).find(
      (r) => r.avh_voucher_id === drawerExpense,
    );
    expect(row).toEqual(
      expect.objectContaining({
        paid_to: `E2E-EXP-${tag}`,
        expense_heads: `E2E-EXP-${tag} Staff Tea`,
        session_no: expect.any(String),
        avh_voucher_status: 'POSTED',
      }),
    );
    expect(String(row!.tenders).split(', ')).toHaveLength(2);
    expect(
      await prisma.$queryRaw<{ code: string }[]>`
        SELECT ppo_code AS code FROM public.print_purpose
         WHERE ppo_code = 'EXPENSE_VOUCHER' AND ppo_company_id IS NULL AND ppo_is_deleted = false`,
    ).toEqual([{ code: EXPENSE_PRINT_PURPOSE_CODE }]);
  });
});

describe('§2.3 · cancel', () => {
  it('a back-office expense is cancelled: a mirror, the tender rows gone', async () => {
    const res = await postAs(officePc, 'expenses/cancel', {
      ...key(backOfficeExpense),
      reason: 'e2e',
    });
    expectStatus(res, 200);
    expect(res.body.data.status).toBe('CANCELLED');
    const live = await prisma.accTenderDetail.count({
      where: { tdSrcDocId: backOfficeExpense, tdIsDeleted: false },
    });
    expect(live).toBe(0);
  });

  it('a drawer expense is refused once the session stops taking money (TILL_SESSION_CLOSED)', async () => {
    const ended = await postAs(tillPc, 'till/sessions/end-billing', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      tssId: session.tssId,
    });
    expectStatus(ended, 200);
    const res = await postAs(tillPc, 'expenses/cancel', { ...key(drawerExpense), reason: 'e2e' });
    expectStatus(res, 409);
    expect(codes(res)).toEqual(['TILL_SESSION_CLOSED']);
  });
});
