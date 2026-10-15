import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { hashSecret } from '../src/common/utils/secret-hash.utils';
import { as, bootIdentityApp, PRATHAP, TESTER } from './helpers/identity-app';
import {
  grantMenuRights,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import { BRANCH, COMPANY, data, expectStatus, prisma } from './helpers/payment-e2e';

/**
 * Notes 113 — a session's cash reaches the safe only when a supervisor
 * receives it, against the dev database, with till.handover_receipt REQUIRED
 * on the branch for the run:
 *
 *   close   CLOSE_HANDOVER posts Dr Till cash awaiting receipt / Cr till cash,
 *           AWAITING; listed (blind) on movements/awaiting-receipt and counted
 *           on days/get
 *   receive refused to the bag's own cashier (TILL_RECEIVER_SELF), without a
 *           PIN, with a wrong one (PIN_FAIL); exact → TRcv Dr safe / Cr
 *           awaiting, RECEIVED, never twice
 *   short   beyond tolerance → a PENDING RECEIVE-stage variance, the session
 *           PENDING; RECOUNT refused, the receiver may not decide it, an
 *           approver's APPROVE EXPENSE posts TVar against awaiting at once
 *   within  tolerance → TVar posted at once (WITHIN_TOLERANCE)
 *   drop    a DROP waits too; once received it is not voided
 *
 * Notes 114 — sessions/approve-cash, one Approve on the closed session:
 *
 *   approve refused to the cashier, without a PIN, with a wrong one, on a
 *           session not yet closed; exact → TRcv, APPROVED, never twice
 *   gap     within tolerance posts at once; beyond it without a treatment is
 *           sent on (a shortage spills from the hand-over onto the drop) and
 *           decided by another approver; with one it is decided in the step
 *           when the caller's grant covers it, refused (nothing written) when not
 *   alone   under till.single_operator the owner approves their own, no PIN
 *
 * Notes 116 — only the session's cashier is refused: the supervisor who closed
 * it for them (the hand-over is theirs) approves its cash.
 *
 * tester1 (SUPER ADMIN) is the cashier on the till PC; prathap the receiver
 * (a CASH_VARIANCE grant up to 150), 'tester' the approver (a remote
 * CASH_VARIANCE grant), both on the office PC. The suite owns its devices,
 * safe, counter, setting rows, prathap's PIN, the grants, and every session it
 * opens.
 *
 *     npm run test:e2e -- till-handover-receipt-http --runInBand
 */

jest.setTimeout(240_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285];
const tag = Date.now().toString(36).toUpperCase().slice(-6);
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
let tillPc: string;
let officePc: string;
let safeId: string;
let safeLedger: string;
let counterId: string;
let note500: string;
let note100: string;
let note5: string | null;
let tillCashLedger: string;
let awaitingLedger: string;
let shortExcessLedger: string;
let countErrorReason: string;
let voidReason: string;
let grantId: string | null = null;
let prathapGrantId: string | null = null;
const sessions: Session[] = [];

type Session = { tssId: string; tssAccYear: string };
type Line = { tenderTypeId: number; denominationId?: string; qty?: number; enteredAmount?: number };
const http = () => request(app.getHttpServer());
const postAs = (who: string, device: string, path: string, body: object) =>
  http().post(`/api/v1/till/${path}`).set('Authorization', as(who, device)).send(body);
const getAs = (who: string, device: string, path: string, query: object) =>
  http().get(`/api/v1/till/${path}`).set('Authorization', as(who, device)).query(query);
const key = (s: Session) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  accYear: s.tssAccYear,
  tssId: s.tssId,
});
const scope = { companyId: COMPANY, branchId: BRANCH };
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};
const notes500 = (qty: number): Line[] => [{ tenderTypeId: 1, denominationId: note500, qty }];

/** Open on the till PC with a 500 float — an OPEN session. */
async function openSession(): Promise<Session> {
  const open = await postAs('tester1', tillPc, 'sessions/open', {
    ...scope,
    floatMode: 'ISSUED',
    floatIssued: 500,
    lines: notes500(1),
  });
  expectStatus(open, 201);
  const s = data<Session>(open);
  sessions.push(s);
  return s;
}

/**
 * End billing, count the drawer exactly (the float by default), close leaving
 * nothing — the close by the cashier at the counter, or by a supervisor from
 * the office (`closedBy`, notes 116).
 */
async function closeSession(
  s: Session,
  lines: Line[] = notes500(1),
  closedBy: { who: string; device: () => string } = { who: 'tester1', device: () => tillPc },
): Promise<void> {
  expectStatus(await postAs('tester1', tillPc, 'sessions/end-billing', key(s)), 200);
  const count = await postAs('tester1', tillPc, 'sessions/count', { ...key(s), lines });
  expect(data<{ outcome: string }>(count).outcome).toBe('ACCEPTED');
  const close = await postAs(closedBy.who, closedBy.device(), 'sessions/close', {
    ...key(s),
    floatLeft: 0,
  });
  expectStatus(close, 200);
}

async function handOver(s: Session) {
  const [row] = await prisma.$queryRaw<
    { id: string; y: string; status: string | null; voucher: string; doc: string }[]
  >`
    SELECT tcm_id::text AS id, tcm_acc_year AS y, tcm_receipt_status AS status,
           tcm_voucher_id::text AS voucher, tcm_doc_no AS doc
      FROM accounts.till_cash_movement
     WHERE tcm_session_id = ${s.tssId}::uuid AND tcm_kind = 'CLOSE_HANDOVER'`;
  return row;
}

async function legsOf(voucherId: string) {
  return prisma.$queryRaw<{ dr_cr: string; ledger: string; amount: string }[]>`
    SELECT trim(av_dr_cr) AS dr_cr, av_ledger_id::text AS ledger, av_amount::text AS amount
      FROM accounts.acc_vouchers
     WHERE av_voucher_id = ${voucherId}::uuid AND av_is_deleted = false
     ORDER BY av_row_no`;
}

/** The awaiting ledger over every voucher of the session: what is still to be received or decided. */
async function awaitingNet(s: Session): Promise<string> {
  const [row] = await prisma.$queryRaw<{ net: string }[]>`
    SELECT COALESCE(sum(CASE WHEN trim(av.av_dr_cr) = 'DR' THEN av.av_amount ELSE -av.av_amount END), 0)::text AS net
      FROM accounts.acc_voucher_header h
      JOIN accounts.acc_vouchers av ON av.av_voucher_id = h.avh_voucher_id AND av.av_acc_year = h.avh_acc_year
     WHERE h.avh_session_id = ${s.tssId}::uuid AND av.av_ledger_id = ${awaitingLedger}::uuid
       AND av.av_is_deleted = false`;
  return Number(row.net).toFixed(2);
}

const approveAs = (who: string, s: Session, body: object = {}, pin: string | null = '2468') =>
  postAs(who, officePc, 'sessions/approve-cash', { ...key(s), approverPin: pin, ...body });

type Approved = {
  handedOver: number;
  received: number;
  difference: number;
  outcome: string;
  tvrId: string | null;
  tcmId: string | null;
  tapId: string | null;
  treatment: string | null;
  varianceVoucherId: string | null;
  varianceVoucherNo: string | null;
  movements: {
    tcmId: string;
    tcmKind: string;
    handedOver: number;
    received: number;
    receiveVoucherId: string | null;
    receiveVoucherNo: string | null;
  }[];
  session: {
    tssVarianceStatus: string;
    receiptState: string;
    cashAwaiting: number;
    receivedBy: string | null;
    receivedOn: string | null;
  };
};

const receiveAs = (
  who: string,
  bags: { id: string; y: string; lines: Line[] }[],
  pin: string | null = '2468',
) =>
  postAs(who, officePc, 'movements/receive', {
    ...scope,
    receiverPin: pin,
    bags: bags.map((b) => ({ tcmId: b.id, accYear: b.y, lines: b.lines })),
  });

beforeAll(async () => {
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-receipt-${tag}-${name}`}, ${`E2E ${name}`}, 'Desktop')
      RETURNING dev_id::text`;
    return row.dev_id;
  };
  tillPc = await device('till');
  officePc = await device('office');

  const denoms = await prisma.$queryRaw<{ tdn_id: string; v: string; k: string }[]>`
    SELECT tdn_id, tdn_value::text AS v, tdn_kind AS k FROM accounts.till_denomination
     WHERE tdn_company_id IS NULL AND tdn_is_deleted = false`;
  note500 = denoms.find((d) => Number(d.v) === 500 && d.k === 'NOTE')!.tdn_id;
  note100 = denoms.find((d) => Number(d.v) === 100 && d.k === 'NOTE')!.tdn_id;
  note5 = denoms.find((d) => Number(d.v) === 5)?.tdn_id ?? null;
  const [cash] = await prisma.$queryRaw<{ tnd_ledger_id: string }[]>`
    SELECT tnd_ledger_id FROM accounts.acc_tender_master
     WHERE tnd_type_id = 1 AND tnd_company_id = ${COMPANY}::uuid
       AND (tnd_branch_id = ${BRANCH}::uuid OR tnd_branch_id IS NULL)
       AND tnd_is_active AND NOT tnd_is_deleted
     ORDER BY (tnd_branch_id IS NULL), tnd_is_default DESC, tnd_display_position, tnd_created_on LIMIT 1`;
  tillCashLedger = cash.tnd_ledger_id;
  const roleLedger = async (role: string) => {
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT alm_ledger_id::text AS id FROM accounts.acc_ledger_map
       WHERE alm_role = ${role} AND alm_is_active AND NOT alm_is_deleted
         AND (alm_company_id IS NULL OR alm_company_id = ${COMPANY}::uuid)
         AND (alm_branch_id IS NULL OR alm_branch_id = ${BRANCH}::uuid)
       ORDER BY (alm_branch_id IS NOT NULL) DESC, (alm_company_id IS NOT NULL) DESC LIMIT 1`;
    return row.id;
  };
  awaitingLedger = await roleLedger('TILL_CASH_AWAITING');
  shortExcessLedger = await roleLedger('CASH_SHORT_EXCESS');
  const reason = async (category: string, code: string) => {
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT trs_id::text AS id FROM accounts.till_reason
       WHERE trs_company_id IS NULL AND trs_category = ${category} AND trs_code = ${code} AND NOT trs_is_deleted`;
    return row.id;
  };
  countErrorReason = await reason('VARIANCE', 'COUNT_ERROR');
  const [anyVoid] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT trs_id::text AS id FROM accounts.till_reason
     WHERE trs_company_id IS NULL AND trs_category = 'MOVEMENT_VOID' AND NOT trs_is_deleted AND NOT trs_needs_note
     ORDER BY trs_sort_order LIMIT 1`;
  voidReason = anyVoid.id;

  for (const user of [TESTER1, PRATHAP, TESTER]) {
    rights.push(await grantMenuRights(prisma, TILL_MENUS, user));
  }
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${await hashSecret('2468')} WHERE usr_id = ${PRATHAP}::uuid`;
  const [grant] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO accounts.till_approval_authority
      (taa_user_id, taa_company_id, taa_branch_id, taa_role, taa_event_code, taa_max_amount, taa_can_remote, taa_created_by)
    VALUES (${TESTER}::uuid, ${COMPANY}::uuid, NULL, 'SUPERVISOR', 'CASH_VARIANCE', 10000, true, 'e2e-receipt')
    RETURNING taa_id::text AS id`;
  grantId = grant.id;
  const [own] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO accounts.till_approval_authority
      (taa_user_id, taa_company_id, taa_branch_id, taa_role, taa_event_code, taa_max_amount, taa_can_remote, taa_created_by)
    VALUES (${PRATHAP}::uuid, ${COMPANY}::uuid, NULL, 'SUPERVISOR', 'CASH_VARIANCE', 150, true, 'e2e-receipt')
    RETURNING taa_id::text AS id`;
  prathapGrantId = own.id;
  await prisma.$executeRaw`
    INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_branch_id, asv_value, asv_created_by)
    VALUES ('till.handover_receipt', 'BRANCH', ${BRANCH}::uuid, 'REQUIRED', 'e2e-receipt')`;
  app = await bootIdentityApp();

  const safe = await postAs('tester1', officePc, 'safes/create', {
    ...{ tsfCompanyId: COMPANY, tsfBranchId: BRANCH },
    tsfCode: `E2ER${tag}`,
    tsfName: 'E2E receipt safe',
    tsfIsDefault: false,
    tsfIsDropSafe: true,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const [ledger] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT tsf_ledger_id::text AS id FROM accounts.till_safe WHERE tsf_id = ${safeId}::uuid`;
  safeLedger = ledger.id;
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`E2ER${tag}`}, 'E2E receipt counter', ${tillPc}::uuid, ${safeId}::uuid, 'e2e-receipt')
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;
});

afterAll(async () => {
  await prisma.$executeRaw`
    DELETE FROM public.app_setting_value
     WHERE asv_setting_key IN ('till.handover_receipt', 'till.single_operator')
       AND asv_branch_id = ${BRANCH}::uuid AND asv_created_by = 'e2e-receipt'`;
  const ids = sessions.map((s) => s.tssId);
  if (ids.length > 0) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_session_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_session_id = ANY(${ids}::uuid[])`;
    const vouchers = await prisma.$queryRaw<{ id: string; y: string }[]>`
      SELECT avh_voucher_id::text AS id, avh_acc_year AS y FROM accounts.acc_voucher_header
       WHERE avh_session_id = ANY(${ids}::uuid[])`;
    for (const v of vouchers) {
      await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id = ${v.id}::uuid AND av_acc_year = ${v.y}`;
      await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${v.id}::uuid AND avh_acc_year = ${v.y}`;
    }
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_id = ANY(${ids}::uuid[])`;
  }
  for (const id of [grantId, prathapGrantId]) {
    if (id) {
      await prisma.$executeRaw`DELETE FROM accounts.till_approval_authority WHERE taa_id = ${id}::uuid`;
    }
  }
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = NULL WHERE usr_id = ${PRATHAP}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_device_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counterId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_id = ${safeId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  for (const memo of rights.reverse()) {
    await restoreMenuRights(prisma, memo);
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('notes 113 · the hand-over waits for a supervisor', () => {
  let s: Session;
  let bag: { id: string; y: string; status: string | null; voucher: string; doc: string };

  it('the close posts the hand-over to Till cash awaiting receipt, not the safe', async () => {
    s = await openSession();
    await closeSession(s);
    bag = await handOver(s);
    expect(bag.status).toBe('AWAITING');
    expect(await legsOf(bag.voucher)).toEqual([
      { dr_cr: 'DR', ledger: awaitingLedger, amount: '500.00' },
      { dr_cr: 'CR', ledger: tillCashLedger, amount: '500.00' },
    ]);
    const got = await getAs('prathap', officePc, 'sessions/get', key(s));
    expectStatus(got, 200);
    expect(
      data<{ receiptState: string; movements: { tcmKind: string; tcmReceiptStatus: string }[] }>(
        got,
      ),
    ).toEqual(
      expect.objectContaining({
        receiptState: 'AWAITING',
        movements: expect.arrayContaining([
          expect.objectContaining({ tcmKind: 'CLOSE_HANDOVER', tcmReceiptStatus: 'AWAITING' }),
        ]),
      }),
    );
  });

  it('it is listed awaiting receipt with no amount, and the business day counts it', async () => {
    const list = await getAs('prathap', officePc, 'movements/awaiting-receipt', scope);
    expectStatus(list, 200);
    const row = data<Record<string, unknown>[]>(list).find((r) => r.tcmId === bag.id);
    expect(row).toEqual(
      expect.objectContaining({
        tcmKind: 'CLOSE_HANDOVER',
        tssId: s.tssId,
        cashierId: TESTER1,
        safeId,
        canReceive: true,
      }),
    );
    expect(Object.keys(row!).some((k) => /amount/i.test(k))).toBe(false);
    const own = await getAs('tester1', tillPc, 'movements/awaiting-receipt', scope);
    expect(data<Record<string, unknown>[]>(own).find((r) => r.tcmId === bag.id)).toEqual(
      expect.objectContaining({ canReceive: false }),
    );

    const day = await getAs('prathap', officePc, 'days/get', scope);
    expectStatus(day, 200);
    expect(data<{ handoverReceipt: string; awaitingReceipt: { thisDay: number } }>(day)).toEqual(
      expect.objectContaining({ handoverReceipt: 'REQUIRED' }),
    );
    expect(
      data<{ awaitingReceipt: { thisDay: number } }>(day).awaitingReceipt.thisDay,
    ).toBeGreaterThanOrEqual(1);
  });

  it('its cashier may not receive it; the receiver signs with their own PIN, a wrong one journalled', async () => {
    const self = await receiveAs('tester1', [{ ...bag, lines: notes500(1) }]);
    expectStatus(self, 403);
    expect(firstError(self)).toEqual(expect.objectContaining({ code: 'TILL_RECEIVER_SELF' }));

    const none = await receiveAs('prathap', [{ ...bag, lines: notes500(1) }], null);
    expectStatus(none, 403);
    expect(firstError(none)).toEqual(
      expect.objectContaining({ code: 'TILL_RECEIVER_PIN_REQUIRED', field: 'receiverPin' }),
    );
    const wrong = await receiveAs('prathap', [{ ...bag, lines: notes500(1) }], '0000');
    expectStatus(wrong, 403);
    expect(firstError(wrong).code).toBe('TILL_RECEIVER_PIN');
    const [fails] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${s.tssId}::uuid AND tev_event_code = 'PIN_FAIL' AND tev_user_id = ${PRATHAP}::uuid`;
    expect(fails.n).toBe(1);
    expect((await handOver(s)).status).toBe('AWAITING');
  });

  it('received in full: TRcv Dr safe / Cr awaiting, RECEIVED, and never twice', async () => {
    const res = await receiveAs('prathap', [{ ...bag, lines: notes500(1) }]);
    expectStatus(res, 200);
    const [got] = data<Record<string, unknown>[]>(res);
    expect(got).toEqual(
      expect.objectContaining({
        tcmId: bag.id,
        handedOver: 500,
        received: 500,
        difference: 0,
        outcome: 'RECEIVED',
        tvrId: null,
      }),
    );
    expect(await legsOf(got.receiveVoucherId as string)).toEqual([
      { dr_cr: 'DR', ledger: safeLedger, amount: '500.00' },
      { dr_cr: 'CR', ledger: awaitingLedger, amount: '500.00' },
    ]);
    expect((await handOver(s)).status).toBe('RECEIVED');
    expect(await awaitingNet(s)).toBe('0.00');
    const [count] = await prisma.$queryRaw<
      { kind: string; blind: boolean; expected: string; by: string }[]
    >`
      SELECT tct_kind AS kind, tct_is_blind AS blind, tct_expected::text AS expected, tct_counted_by::text AS by
        FROM accounts.till_count WHERE tct_movement_id = ${bag.id}::uuid`;
    expect(count).toEqual({ kind: 'DROP_VERIFY', blind: true, expected: '500.00', by: PRATHAP });

    const again = await receiveAs('prathap', [{ ...bag, lines: notes500(1) }]);
    expectStatus(again, 409);
    expect(firstError(again)).toEqual(
      expect.objectContaining({ code: 'TILL_RECEIPT_NOT_AWAITING', receiptStatus: 'RECEIVED' }),
    );
    const got2 = await getAs('prathap', officePc, 'sessions/get', key(s));
    expect(data<{ receiptState: string }>(got2).receiptState).toBe('APPROVED');
  });
});

describe('notes 113 · a receive difference is the session’s variance', () => {
  it('short beyond tolerance: PENDING; RECOUNT refused, the receiver may not decide, an approver’s EXPENSE posts at once', async () => {
    const s = await openSession();
    await closeSession(s);
    const bag = await handOver(s);
    const res = await receiveAs('prathap', [
      { ...bag, lines: [{ tenderTypeId: 1, denominationId: note100, qty: 4 }] },
    ]);
    expectStatus(res, 200);
    const [got] =
      data<{ outcome: string; tvrId: string; difference: number; receiveVoucherId: string }[]>(res);
    expect(got).toEqual(
      expect.objectContaining({ outcome: 'SENT_FOR_APPROVAL', difference: -100, received: 400 }),
    );
    expect(await legsOf(got.receiveVoucherId)).toEqual([
      { dr_cr: 'DR', ledger: safeLedger, amount: '400.00' },
      { dr_cr: 'CR', ledger: awaitingLedger, amount: '400.00' },
    ]);
    expect(await awaitingNet(s)).toBe('100.00');
    const [v] = await prisma.$queryRaw<
      {
        stage: string;
        movement: string;
        treatment: string;
        expected: string;
        counted: string;
        open: string;
      }[]
    >`
      SELECT tvr_stage AS stage, tvr_movement_id::text AS movement, tvr_treatment AS treatment,
             tvr_expected::text AS expected, tvr_counted::text AS counted, tvr_open_amount::text AS open
        FROM accounts.till_variance WHERE tvr_id = ${got.tvrId}::uuid`;
    expect(v).toEqual({
      stage: 'RECEIVE',
      movement: bag.id,
      treatment: 'PENDING',
      expected: '500.00',
      counted: '400.00',
      open: '500.00',
    });
    const after = data<{ tssStatus: string; tssVarianceStatus: string; receiptState: string }>(
      await getAs('prathap', officePc, 'sessions/get', key(s)),
    );
    expect(after).toEqual(
      expect.objectContaining({
        tssStatus: 'CLOSED',
        tssVarianceStatus: 'PENDING',
        receiptState: 'DIFFERENCE',
      }),
    );

    const decide = (who: string, body: object) =>
      postAs(who, officePc, 'sessions/decide-variance', {
        ...key(s),
        tcmId: bag.id,
        note: 'e2e receive',
        ...body,
      });
    const recount = await decide('tester', { decision: 'RECOUNT' });
    expectStatus(recount, 400);
    const byReceiver = await decide('prathap', {
      decision: 'APPROVE',
      treatment: 'EXPENSE',
      reasonId: countErrorReason,
      approverPin: '2468',
    });
    expectStatus(byReceiver, 403);
    expect(firstError(byReceiver).code).toBe('TILL_APPROVER_SELF');
    const byCashier = await decide('tester1', {
      decision: 'APPROVE',
      treatment: 'EXPENSE',
      reasonId: countErrorReason,
    });
    expectStatus(byCashier, 403);
    expect(firstError(byCashier).code).toBe('TILL_APPROVER_SELF');

    const ok = await decide('tester', {
      decision: 'APPROVE',
      treatment: 'EXPENSE',
      reasonId: countErrorReason,
    });
    expectStatus(ok, 200);
    expect(data(ok)).toEqual(
      expect.objectContaining({
        tcmId: bag.id,
        treatment: 'EXPENSE',
        amount: 100,
        channel: 'REMOTE',
        session: expect.objectContaining({ tssStatus: 'CLOSED', tssVarianceStatus: 'ACCEPTED' }),
      }),
    );
    const [posted] = await prisma.$queryRaw<
      { status: string; voucher: string; approval: string }[]
    >`
      SELECT tvr_status AS status, tvr_voucher_id::text AS voucher, tvr_approval_id::text AS approval
        FROM accounts.till_variance WHERE tvr_id = ${got.tvrId}::uuid`;
    expect(posted.status).toBe('POSTED');
    expect(await legsOf(posted.voucher)).toEqual([
      { dr_cr: 'DR', ledger: shortExcessLedger, amount: '100.00' },
      { dr_cr: 'CR', ledger: awaitingLedger, amount: '100.00' },
    ]);
    expect(await awaitingNet(s)).toBe('0.00');
    const [approval] = await prisma.$queryRaw<
      { status: string; src: string; doc: string; by: string; req: string }[]
    >`
      SELECT tap_status AS status, tap_src_doc_type AS src, tap_src_doc_id::text AS doc,
             tap_decided_by::text AS by, tap_requested_by::text AS req
        FROM accounts.till_approval WHERE tap_id = ${posted.approval}::uuid`;
    expect(approval).toEqual({
      status: 'APPROVED',
      src: 'TILL_MOVEMENT',
      doc: bag.id,
      by: TESTER,
      req: PRATHAP,
    });

    const twice = await decide('tester', {
      decision: 'APPROVE',
      treatment: 'EXPENSE',
      reasonId: countErrorReason,
    });
    expectStatus(twice, 409);
    expect(firstError(twice).code).toBe('TILL_VARIANCE_NOT_PENDING');
  });

  it('within tolerance: the difference posts at once (WITHIN_TOLERANCE)', async () => {
    if (!note5) {
      return;
    }
    const s = await openSession();
    await closeSession(s);
    const bag = await handOver(s);
    const res = await receiveAs('prathap', [
      {
        ...bag,
        lines: [
          { tenderTypeId: 1, denominationId: note100, qty: 4 },
          { tenderTypeId: 1, denominationId: note5, qty: 19 },
        ],
      },
    ]);
    expectStatus(res, 200);
    const [got] = data<{ outcome: string; tvrId: string; difference: number }[]>(res);
    expect(got).toEqual(expect.objectContaining({ outcome: 'WITHIN_TOLERANCE', difference: -5 }));
    const [v] = await prisma.$queryRaw<{ treatment: string; status: string; voucher: string }[]>`
      SELECT tvr_treatment AS treatment, tvr_status AS status, tvr_voucher_id::text AS voucher
        FROM accounts.till_variance WHERE tvr_id = ${got.tvrId}::uuid`;
    expect(v).toEqual(expect.objectContaining({ treatment: 'WITHIN_TOLERANCE', status: 'POSTED' }));
    expect(await legsOf(v.voucher)).toEqual([
      { dr_cr: 'DR', ledger: shortExcessLedger, amount: '5.00' },
      { dr_cr: 'CR', ledger: awaitingLedger, amount: '5.00' },
    ]);
    expect(await awaitingNet(s)).toBe('0.00');
  });
});

describe('notes 113 · a drop waits too', () => {
  it('a DROP posts to awaiting; once received it is not voided', async () => {
    const s = await openSession();
    const drop = await postAs('tester1', tillPc, 'movements/create', {
      ...key(s),
      kind: 'DROP',
      amount: 300,
      bagNo: `B-${tag}`,
    });
    expectStatus(drop, 201);
    const d = data<{
      tcmId: string;
      tcmAccYear: string;
      tcmVoucherId: string;
      tcmReceiptStatus: string;
    }>(drop);
    expect(d.tcmReceiptStatus).toBe('AWAITING');
    expect(await legsOf(d.tcmVoucherId)).toEqual([
      { dr_cr: 'DR', ledger: awaitingLedger, amount: '300.00' },
      { dr_cr: 'CR', ledger: tillCashLedger, amount: '300.00' },
    ]);

    const res = await receiveAs('prathap', [
      {
        id: d.tcmId,
        y: d.tcmAccYear,
        lines: [{ tenderTypeId: 1, denominationId: note100, qty: 3 }],
      },
    ]);
    expectStatus(res, 200);
    expect(data<{ outcome: string }[]>(res)[0].outcome).toBe('RECEIVED');

    const voided = await postAs('prathap', officePc, 'movements/void', {
      ...scope,
      accYear: d.tcmAccYear,
      tcmId: d.tcmId,
      reasonId: voidReason,
    });
    expectStatus(voided, 409);
    expect(firstError(voided).code).toBe('TILL_MOVEMENT_NOT_VOIDABLE');

    // the drawer expected the drop out (500 − 300): the close hands over 200, which waits
    await closeSession(s, [{ tenderTypeId: 1, denominationId: note100, qty: 2 }]);
    expect((await handOver(s)).status).toBe('AWAITING');
    expect(await awaitingNet(s)).toBe('200.00');
  });
});

describe('notes 114 · the supervisor approves the session’s cash', () => {
  let s: Session;

  it('refused on a session still open, to its cashier, without a PIN and with a wrong one', async () => {
    s = await openSession();
    const open = await approveAs('prathap', s);
    expectStatus(open, 409);
    expect(firstError(open)).toEqual(
      expect.objectContaining({ code: 'TILL_SESSION_NOT_OPEN', status: 'OPEN' }),
    );
    await closeSession(s);
    const before = data<{ receiptState: string; cashAwaiting: number; receivedBy: null }>(
      await getAs('prathap', officePc, 'sessions/get', key(s)),
    );
    expect(before).toEqual(
      expect.objectContaining({ receiptState: 'AWAITING', cashAwaiting: 500, receivedBy: null }),
    );

    const self = await approveAs('tester1', s);
    expectStatus(self, 403);
    expect(firstError(self)).toEqual(
      expect.objectContaining({
        code: 'TILL_RECEIVER_SELF',
        message: expect.stringContaining('you were its cashier'),
      }),
    );
    const none = await approveAs('prathap', s, {}, null);
    expectStatus(none, 403);
    expect(firstError(none)).toEqual(
      expect.objectContaining({ code: 'TILL_RECEIVER_PIN_REQUIRED', field: 'approverPin' }),
    );
    const wrong = await approveAs('prathap', s, {}, '0000');
    expectStatus(wrong, 403);
    expect(firstError(wrong).code).toBe('TILL_RECEIVER_PIN');
    const [fails] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${s.tssId}::uuid AND tev_event_code = 'PIN_FAIL' AND tev_user_id = ${PRATHAP}::uuid`;
    expect(fails.n).toBe(1);
    expect((await handOver(s)).status).toBe('AWAITING');
  });

  it('approved as handed over: TRcv Dr safe / Cr awaiting, APPROVED, no count, never twice', async () => {
    const res = await approveAs('prathap', s);
    expectStatus(res, 200);
    const got = data<Approved>(res);
    expect(got).toEqual(
      expect.objectContaining({
        handedOver: 500,
        received: 500,
        difference: 0,
        outcome: 'APPROVED',
        tvrId: null,
        tcmId: null,
      }),
    );
    expect(got.movements).toHaveLength(1);
    expect(got.movements[0].receiveVoucherNo).toEqual(expect.any(String));
    expect(await legsOf(got.movements[0].receiveVoucherId!)).toEqual([
      { dr_cr: 'DR', ledger: safeLedger, amount: '500.00' },
      { dr_cr: 'CR', ledger: awaitingLedger, amount: '500.00' },
    ]);
    expect(got.session).toEqual(
      expect.objectContaining({
        receiptState: 'APPROVED',
        cashAwaiting: 0,
        receivedBy: PRATHAP,
        receivedOn: expect.any(String),
      }),
    );
    expect(await awaitingNet(s)).toBe('0.00');
    const [row] = await prisma.$queryRaw<
      { status: string; amount: string; count: string | null }[]
    >`
      SELECT tcm_receipt_status AS status, tcm_received_amount::text AS amount,
             tcm_receive_count_id::text AS count
        FROM accounts.till_cash_movement
       WHERE tcm_session_id = ${s.tssId}::uuid AND tcm_kind = 'CLOSE_HANDOVER'`;
    expect(row).toEqual({ status: 'RECEIVED', amount: '500.00', count: null });

    const again = await approveAs('prathap', s);
    expectStatus(again, 409);
    expect(firstError(again)).toEqual(
      expect.objectContaining({ code: 'TILL_CASH_ALREADY_APPROVED', receivedBy: PRATHAP }),
    );
  });
});

describe('notes 116 · the supervisor who closed the session approves its cash', () => {
  it('a supervisor closes for the cashier, the hand-over is theirs, and they approve it', async () => {
    const s = await openSession();
    await closeSession(s, notes500(1), { who: 'prathap', device: () => officePc });
    const [hand] = await prisma.$queryRaw<{ by: string; status: string }[]>`
      SELECT tcm_done_by::text AS by, tcm_receipt_status AS status
        FROM accounts.till_cash_movement
       WHERE tcm_session_id = ${s.tssId}::uuid AND tcm_kind = 'CLOSE_HANDOVER'`;
    expect(hand).toEqual({ by: PRATHAP, status: 'AWAITING' });

    const res = await approveAs('prathap', s);
    expectStatus(res, 200);
    expect(data<Approved>(res)).toEqual(
      expect.objectContaining({
        outcome: 'APPROVED',
        received: 500,
        session: expect.objectContaining({ receiptState: 'APPROVED', receivedBy: PRATHAP }),
      }),
    );
  });
});

describe('notes 114 · a gap on the approval', () => {
  it('within tolerance: posted at once', async () => {
    const s = await openSession();
    await closeSession(s);
    const res = await approveAs('prathap', s, { receivedAmount: 495 });
    expectStatus(res, 200);
    const got = data<Approved>(res);
    expect(got).toEqual(
      expect.objectContaining({ outcome: 'WITHIN_TOLERANCE', difference: -5, received: 495 }),
    );
    expect(got.varianceVoucherNo).toEqual(expect.any(String));
    expect(await legsOf(got.varianceVoucherId!)).toEqual([
      { dr_cr: 'DR', ledger: shortExcessLedger, amount: '5.00' },
      { dr_cr: 'CR', ledger: awaitingLedger, amount: '5.00' },
    ]);
    expect(await awaitingNet(s)).toBe('0.00');
    expect(got.session).toEqual(
      expect.objectContaining({
        receiptState: 'DIFFERENCE',
        tssVarianceStatus: 'WITHIN_TOLERANCE',
      }),
    );
  });

  it('beyond it, sent on: the shortage spills from the hand-over onto the drop; another approver decides', async () => {
    const s = await openSession();
    const drop = await postAs('tester1', tillPc, 'movements/create', {
      ...key(s),
      kind: 'DROP',
      amount: 300,
      bagNo: `B2-${tag}`,
    });
    expectStatus(drop, 201);
    const dropId = data<{ tcmId: string }>(drop).tcmId;
    await closeSession(s, [{ tenderTypeId: 1, denominationId: note100, qty: 2 }]);
    const hand = await handOver(s);
    expect(
      data<{ cashAwaiting: number }>(await getAs('prathap', officePc, 'sessions/get', key(s)))
        .cashAwaiting,
    ).toBe(500);

    const res = await approveAs('prathap', s, { receivedAmount: 250 });
    expectStatus(res, 200);
    const got = data<Approved>(res);
    expect(got).toEqual(
      expect.objectContaining({
        handedOver: 500,
        received: 250,
        difference: -250,
        outcome: 'SENT_FOR_APPROVAL',
        tcmId: hand.id,
        varianceVoucherId: null,
      }),
    );
    expect(got.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tcmId: hand.id,
          handedOver: 200,
          received: 0,
          receiveVoucherId: null,
        }),
        expect.objectContaining({ tcmId: dropId, handedOver: 300, received: 250 }),
      ]),
    );
    expect(await awaitingNet(s)).toBe('250.00');
    expect(got.session).toEqual(
      expect.objectContaining({
        receiptState: 'DIFFERENCE',
        tssVarianceStatus: 'PENDING',
        cashAwaiting: 0,
      }),
    );
    const [v] = await prisma.$queryRaw<
      { movement: string; treatment: string; expected: string; counted: string }[]
    >`
      SELECT tvr_movement_id::text AS movement, tvr_treatment AS treatment,
             tvr_expected::text AS expected, tvr_counted::text AS counted
        FROM accounts.till_variance WHERE tvr_id = ${got.tvrId}::uuid`;
    expect(v).toEqual({
      movement: hand.id,
      treatment: 'PENDING',
      expected: '500.00',
      counted: '250.00',
    });

    const decide = (who: string) =>
      postAs(who, officePc, 'sessions/decide-variance', {
        ...key(s),
        tcmId: got.tcmId,
        decision: 'APPROVE',
        treatment: 'EXPENSE',
        reasonId: countErrorReason,
        note: 'e2e approve-cash',
        approverPin: who === 'prathap' ? '2468' : null,
      });
    const bySupervisor = await decide('prathap');
    expectStatus(bySupervisor, 403);
    expect(firstError(bySupervisor).code).toBe('TILL_APPROVER_SELF');
    const ok = await decide('tester');
    expectStatus(ok, 200);
    expect(await awaitingNet(s)).toBe('0.00');
  });

  it('beyond it, decided in the step when the caller’s grant covers it; refused, nothing written, when not', async () => {
    const big = await openSession();
    await closeSession(big);
    const over = await approveAs('prathap', big, {
      receivedAmount: 300,
      treatment: 'EXPENSE',
      reasonId: countErrorReason,
    });
    expectStatus(over, 403);
    expect(firstError(over).code).toBe('TILL_APPROVER_LIMIT');
    expect((await handOver(big)).status).toBe('AWAITING');
    expect(await awaitingNet(big)).toBe('500.00');

    const s = await openSession();
    await closeSession(s);
    const res = await approveAs('prathap', s, {
      receivedAmount: 400,
      treatment: 'EXPENSE',
      reasonId: countErrorReason,
    });
    expectStatus(res, 200);
    const got = data<Approved>(res);
    expect(got).toEqual(
      expect.objectContaining({ outcome: 'DECIDED', treatment: 'EXPENSE', difference: -100 }),
    );
    expect(await legsOf(got.varianceVoucherId!)).toEqual([
      { dr_cr: 'DR', ledger: shortExcessLedger, amount: '100.00' },
      { dr_cr: 'CR', ledger: awaitingLedger, amount: '100.00' },
    ]);
    expect(await awaitingNet(s)).toBe('0.00');
    expect(got.session).toEqual(
      expect.objectContaining({ receiptState: 'DIFFERENCE', tssVarianceStatus: 'ACCEPTED' }),
    );
    const [approval] = await prisma.$queryRaw<{ status: string; by: string; req: string }[]>`
      SELECT tap_status AS status, tap_decided_by::text AS by, tap_requested_by::text AS req
        FROM accounts.till_approval WHERE tap_id = ${got.tapId}::uuid`;
    expect(approval).toEqual({ status: 'APPROVED', by: PRATHAP, req: TESTER1 });
  });
});

describe('notes 114 · a one-person shop', () => {
  it('under till.single_operator the owner approves their own session without a PIN', async () => {
    const s = await openSession();
    await closeSession(s);
    await prisma.$executeRaw`
      INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_branch_id, asv_value, asv_created_by)
      VALUES ('till.single_operator', 'BRANCH', ${BRANCH}::uuid, 'true', 'e2e-receipt')`;
    try {
      const res = await approveAs('tester1', s, {}, null);
      expectStatus(res, 200);
      expect(data<Approved>(res)).toEqual(
        expect.objectContaining({
          outcome: 'APPROVED',
          session: expect.objectContaining({ receiptState: 'APPROVED', receivedBy: TESTER1 }),
        }),
      );
    } finally {
      await prisma.$executeRaw`
        DELETE FROM public.app_setting_value
         WHERE asv_setting_key = 'till.single_operator' AND asv_branch_id = ${BRANCH}::uuid
           AND asv_created_by = 'e2e-receipt'`;
    }
  });
});
