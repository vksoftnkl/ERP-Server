import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { hashSecret } from '../src/common/utils/secret-hash.utils';
import {
  TillDayHeaderProvider,
  TillSessionHeaderProvider,
} from '../src/modules/settings/print-render/data/providers/till.providers';
import { as, bootIdentityApp, PRATHAP, TESTER } from './helpers/identity-app';
import {
  grantMenuRights,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import { COMPANY, data, expectStatus, prisma } from './helpers/payment-e2e';

/**
 * Notes 117 — the day close and the session exceptions, on a TEMPORARY BRANCH
 * of the e2e company: a business day closed here must never be the live
 * branch's (notes 115). The branch inherits the company's
 * till.handover_receipt (REQUIRED on the dev box), so every close hands over
 * to "awaiting receipt".
 *
 *   x-read    numbered; refused to the session's own cashier
 *   force     the cashier refused, a wrong PIN journalled; the supervisor's
 *             count closes it, the hand-over theirs to approve (notes 116)
 *   reopen    refused once the cash is approved; else the hand-over voided,
 *             back to COUNTING, re-closed under the same Z
 *   day       close-check RED / GREEN; a blocked close; a clean close (store
 *             Z, totals), no session on a closed day, no session reopen under
 *             it; reopen (Z kept), refused under a later closed day; a close
 *             over a live session by exception (counts, a second approver)
 *   print     the till.session / till.day providers
 *
 * tester1 (SUPER ADMIN) is the cashier and reopens the day remotely; prathap
 * the supervisor (FORCE_CLOSE + SESSION_REOPEN grants, PIN 2468); 'tester' the
 * day-close exception's approver (a DAY_CLOSE_EXCEPTION grant, PIN 1357).
 *
 * Notes 118: the safe count is not this suite's — till.day_close_safe_count is
 * off for the temporary branch, so SAFE_NOT_COUNTED is AMBER (till-safe-http
 * covers it RED).
 *
 *     npm run test:e2e -- till-day-close-http --runInBand
 */

jest.setTimeout(240_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285];
const tag = Date.now().toString(36).toUpperCase().slice(-6);
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
let branchId: string;
let tillPc: string;
let officePc: string;
let safeId: string;
let counterId: string;
let note500: string;
let note100: string;
const grants: string[] = [];
let testerPin: string | null = null;
const reasons: Record<string, string> = {};

type Session = { tssId: string; tssAccYear: string };
type Line = { tenderTypeId: number; denominationId?: string; qty?: number };
const http = () => request(app.getHttpServer());
const postAs = (who: string, device: string, path: string, body: object) =>
  http().post(`/api/v1/till/${path}`).set('Authorization', as(who, device)).send(body);
const getAs = (who: string, device: string, path: string, query: object) =>
  http().get(`/api/v1/till/${path}`).set('Authorization', as(who, device)).query(query);
const scope = () => ({ companyId: COMPANY, branchId });
const key = (s: Session) => ({ ...scope(), accYear: s.tssAccYear, tssId: s.tssId });
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};
const notes500 = (qty: number): Line[] => [{ tenderTypeId: 1, denominationId: note500, qty }];

async function openSession(): Promise<Session & { tssDayId: string }> {
  const open = await postAs('tester1', tillPc, 'sessions/open', {
    ...scope(),
    floatMode: 'ISSUED',
    floatIssued: 500,
    lines: notes500(1),
  });
  expectStatus(open, 201);
  return data<Session & { tssDayId: string }>(open);
}

/** End billing, count the float back exactly, close leaving nothing — the cashier at the counter. */
async function closeSession(s: Session): Promise<void> {
  expectStatus(await postAs('tester1', tillPc, 'sessions/end-billing', key(s)), 200);
  const count = await postAs('tester1', tillPc, 'sessions/count', {
    ...key(s),
    lines: notes500(1),
  });
  expect(data<{ outcome: string }>(count).outcome).toBe('ACCEPTED');
  expectStatus(await postAs('tester1', tillPc, 'sessions/close', { ...key(s), floatLeft: 0 }), 200);
}

async function handOver(s: Session) {
  const [row] = await prisma.$queryRaw<
    { status: string; receipt: string | null; by: string; voucher: string }[]
  >`
    SELECT tcm_status AS status, tcm_receipt_status AS receipt, tcm_done_by::text AS by,
           tcm_voucher_id::text AS voucher
      FROM accounts.till_cash_movement
     WHERE tcm_session_id = ${s.tssId}::uuid AND tcm_kind = 'CLOSE_HANDOVER'
     ORDER BY tcm_created_on DESC LIMIT 1`;
  return row;
}

/** A print provider's context: the day's (or a session's) document, printed by the supervisor. */
const printCtx = (docId: string, accYear: string) => ({
  context: {
    companyId: COMPANY,
    branchId,
    accYear,
    docId,
    userId: PRATHAP,
    deviceId: officePc,
  },
  params: {},
  lang: 'en',
  rowLimit: 100,
});

const dayKey = (day: { tbdId: string; tbdAccYear: string }) => ({
  ...scope(),
  accYear: day.tbdAccYear,
  tbdId: day.tbdId,
});

beforeAll(async () => {
  const [branch] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO public.branch_master (br_comp_id, br_name, br_state_code, br_is_default)
    SELECT ${COMPANY}::uuid, ${`E2E day close ${tag}`}, br_state_code, false
      FROM public.branch_master WHERE br_comp_id = ${COMPANY}::uuid AND br_is_deleted = false
     ORDER BY br_is_default DESC LIMIT 1
    RETURNING br_id::text AS id`;
  branchId = branch.id;
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${branchId}::uuid, ${`e2e-dayclose-${tag}-${name}`}, ${`E2E ${name}`}, 'Desktop')
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
  const rows = await prisma.$queryRaw<{ c: string; k: string; id: string }[]>`
    SELECT trs_category AS c, trs_code AS k, trs_id::text AS id FROM accounts.till_reason
     WHERE trs_company_id IS NULL AND NOT trs_is_deleted
       AND trs_category IN ('FORCE_CLOSE', 'REOPEN', 'DAY_CLOSE', 'DAY_REOPEN')`;
  for (const r of rows) {
    reasons[`${r.c}.${r.k}`] = r.id;
  }

  for (const user of [TESTER1, PRATHAP, TESTER]) {
    rights.push(await grantMenuRights(prisma, TILL_MENUS, user));
  }
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${await hashSecret('2468')} WHERE usr_id = ${PRATHAP}::uuid`;
  const [pin] = await prisma.$queryRaw<{ h: string | null }[]>`
    SELECT usr_pin_hash AS h FROM public.user_master WHERE usr_id = ${TESTER}::uuid`;
  testerPin = pin?.h ?? null;
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${await hashSecret('1357')} WHERE usr_id = ${TESTER}::uuid`;
  const grant = async (user: string, role: string, event: string) => {
    const [g] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO accounts.till_approval_authority
        (taa_user_id, taa_company_id, taa_branch_id, taa_role, taa_event_code, taa_max_amount, taa_can_remote, taa_created_by)
      VALUES (${user}::uuid, ${COMPANY}::uuid, ${branchId}::uuid, ${role}, ${event}, NULL, false, 'e2e-dayclose')
      RETURNING taa_id::text AS id`;
    grants.push(g.id);
  };
  await grant(PRATHAP, 'STORE_MANAGER', 'FORCE_CLOSE');
  await grant(PRATHAP, 'STORE_MANAGER', 'SESSION_REOPEN');
  await grant(TESTER, 'STORE_MANAGER', 'DAY_CLOSE_EXCEPTION');

  await prisma.$executeRaw`
    INSERT INTO public.app_setting_value
      (asv_setting_key, asv_scope, asv_branch_id, asv_value, asv_created_by)
    VALUES ('till.day_close_safe_count', 'BRANCH', ${branchId}::uuid, 'false', 'e2e-dayclose')`;

  app = await bootIdentityApp();
  const safe = await postAs('tester1', officePc, 'safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: branchId,
    tsfCode: `E2ED${tag}`,
    tsfName: 'E2E day close safe',
    tsfIsDefault: true,
    tsfIsDropSafe: true,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${branchId}::uuid, ${`E2ED${tag}`}, 'E2E day close counter', ${tillPc}::uuid, ${safeId}::uuid, 'e2e-dayclose')
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;
});

afterAll(async () => {
  // Everything of the temporary branch is this suite's own (notes 115).
  if (branchId) {
    const sessions = await prisma.$queryRaw<{ id: string }[]>`
      SELECT tss_id::text AS id FROM accounts.till_session WHERE tss_branch_id = ${branchId}::uuid`;
    const ids = sessions.map((s) => s.id);
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM accounts.till_count_line WHERE tcl_count_id IN (
        SELECT tct_id FROM accounts.till_count WHERE tct_session_id = ANY(${ids}::uuid[]))`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ANY(${ids}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_branch_id = ${branchId}::uuid`;
    const vouchers = await prisma.$queryRaw<{ id: string; y: string }[]>`
      SELECT avh_voucher_id::text AS id, avh_acc_year AS y FROM accounts.acc_voucher_header
       WHERE avh_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`
      UPDATE accounts.acc_voucher_header SET avh_reversal_voucher_id = NULL, avh_reversal_acc_year = NULL
       WHERE avh_branch_id = ${branchId}::uuid`;
    for (const v of vouchers) {
      await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id = ${v.id}::uuid AND av_acc_year = ${v.y}`;
    }
    for (const v of vouchers) {
      await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${v.id}::uuid AND avh_acc_year = ${v.y}`;
    }
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_business_day WHERE tbd_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counterId ?? null}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_id = ${safeId ?? null}::uuid`;
    await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.app_setting_value WHERE asv_branch_id = ${branchId}::uuid`;
  }
  for (const id of grants) {
    await prisma.$executeRaw`DELETE FROM accounts.till_approval_authority WHERE taa_id = ${id}::uuid`;
  }
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = NULL WHERE usr_id = ${PRATHAP}::uuid`;
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${testerPin} WHERE usr_id = ${TESTER}::uuid`;
  for (const memo of rights.reverse()) {
    await restoreMenuRights(prisma, memo);
  }
  if (branchId) {
    await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_seq WHERE seq_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM public.branch_master WHERE br_id = ${branchId}::uuid`;
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('notes 117 · the session exceptions', () => {
  let s: Session & { tssDayId: string };

  it('an X read is numbered, journalled, and refused to the session’s own cashier', async () => {
    s = await openSession();
    const own = await postAs('tester1', tillPc, 'sessions/x-report', key(s));
    expectStatus(own, 403);
    expect(firstError(own).code).toBe('TILL_BLIND_CLOSE');
    const x1 = await postAs('prathap', officePc, 'sessions/x-report', key(s));
    expectStatus(x1, 200);
    expect(data<{ xNo: number; tssSessionNo: string; expectedVisible: boolean }>(x1)).toEqual(
      expect.objectContaining({ xNo: 1, expectedVisible: true }),
    );
    const x2 = await postAs('prathap', officePc, 'sessions/x-report', key(s));
    expect(data<{ xNo: number }>(x2).xNo).toBe(2);
  });

  it('force close: the cashier refused, a wrong PIN journalled; the supervisor’s count closes it', async () => {
    const body = {
      ...key(s),
      reasonId: reasons['FORCE_CLOSE.SHIFT_OVER'],
      lines: notes500(1),
      floatLeft: 0,
    };
    const self = await postAs('tester1', tillPc, 'sessions/force-close', {
      ...body,
      approverPin: '0000',
    });
    expectStatus(self, 403);
    expect(firstError(self).code).toBe('TILL_APPROVER_SELF');
    const wrong = await postAs('prathap', officePc, 'sessions/force-close', {
      ...body,
      approverPin: '0000',
    });
    expectStatus(wrong, 403);
    expect(firstError(wrong).code).toBe('TILL_APPROVER_PIN');
    const [fails] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${s.tssId}::uuid AND tev_event_code = 'PIN_FAIL'`;
    expect(fails.n).toBe(1);

    const res = await postAs('prathap', officePc, 'sessions/force-close', {
      ...body,
      approverPin: '2468',
    });
    expectStatus(res, 200);
    const got = data<{
      outcome: string;
      session: { tssStatus: string; tssForceClosed: boolean; tssZNo: number; receiptState: string };
    }>(res);
    expect(got.outcome).toBe('CLOSED');
    expect(got.session).toEqual(
      expect.objectContaining({
        tssStatus: 'CLOSED',
        tssForceClosed: true,
        receiptState: 'AWAITING',
      }),
    );
    expect(await handOver(s)).toEqual(
      expect.objectContaining({ status: 'POSTED', receipt: 'AWAITING', by: PRATHAP }),
    );
    const [count] = await prisma.$queryRaw<{ by: string; place: string }[]>`
      SELECT c.tct_counted_by::text AS by, s.tss_count_place AS place
        FROM accounts.till_session s JOIN accounts.till_count c ON c.tct_id = s.tss_close_count_id
       WHERE s.tss_id = ${s.tssId}::uuid`;
    expect(count).toEqual({ by: PRATHAP, place: 'CASH_OFFICE' });
    const approve = await postAs('prathap', officePc, 'sessions/approve-cash', {
      ...key(s),
      approverPin: '2468',
    });
    expectStatus(approve, 200);
  });

  it('reopen: refused once the cash is approved; else the hand-over voided and re-closed under the same Z', async () => {
    const approved = await postAs('prathap', officePc, 'sessions/reopen', {
      ...key(s),
      reasonId: reasons['REOPEN.COUNT_ERROR'],
      approverPin: '2468',
      notes: 'e2e',
    });
    expectStatus(approved, 409);
    expect(firstError(approved).code).toBe('TILL_CASH_ALREADY_APPROVED');

    const r = await openSession();
    await closeSession(r);
    const before = await handOver(r);
    const [z] = await prisma.$queryRaw<{ z: number }[]>`
      SELECT tss_z_no AS z FROM accounts.till_session WHERE tss_id = ${r.tssId}::uuid`;
    const byCashier = await postAs('tester1', tillPc, 'sessions/reopen', {
      ...key(r),
      reasonId: reasons['REOPEN.COUNT_ERROR'],
      notes: 'e2e',
    });
    expectStatus(byCashier, 403);
    expect(firstError(byCashier).code).toBe('TILL_APPROVER_SELF');
    const res = await postAs('prathap', officePc, 'sessions/reopen', {
      ...key(r),
      reasonId: reasons['REOPEN.COUNT_ERROR'],
      approverPin: '2468',
      notes: 'e2e',
    });
    expectStatus(res, 200);
    const got = data<{
      reversalVoucherIds: string[];
      session: { tssStatus: string; tssReopenCount: number; tssZNo: number };
    }>(res);
    expect(got.session).toEqual(
      expect.objectContaining({ tssStatus: 'COUNTING', tssReopenCount: 1, tssZNo: z.z }),
    );
    expect(got.reversalVoucherIds).toHaveLength(1);
    expect((await handOver(r)).status).toBe('VOIDED');
    const [orig] = await prisma.$queryRaw<{ status: string }[]>`
      SELECT avh_voucher_status AS status FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${before.voucher}::uuid`;
    expect(orig.status).toBe('CANCELLED');

    // the cashier counts again and closes: the same Z, a new hand-over
    const count = await postAs('tester1', tillPc, 'sessions/count', {
      ...key(r),
      lines: notes500(1),
    });
    expect(data<{ outcome: string }>(count).outcome).toBe('ACCEPTED');
    const close = await postAs('tester1', tillPc, 'sessions/close', { ...key(r), floatLeft: 0 });
    expectStatus(close, 200);
    expect(data<{ tssZNo: number }>(close).tssZNo).toBe(z.z);
    expect((await handOver(r)).status).toBe('POSTED');
    expectStatus(
      await postAs('prathap', officePc, 'sessions/approve-cash', {
        ...key(r),
        approverPin: '2468',
      }),
      200,
    );
  });
});

describe('notes 117 · the business day', () => {
  let day: { tbdId: string; tbdAccYear: string };
  let zNo: number;

  it('close-check: SESSIONS_LIVE is RED, an exception may cover it; the close refuses without one', async () => {
    const live = await openSession();
    day = { tbdId: live.tssDayId, tbdAccYear: live.tssAccYear };
    const check = await getAs('prathap', officePc, 'days/close-check', dayKey(day));
    expectStatus(check, 200);
    const got = data<{
      items: { code: string; tone: string; count: number; sessionIds: string[] }[];
      canClose: boolean;
      canCloseWithException: boolean;
    }>(check);
    expect(got.items.map((i) => i.code).sort()).toEqual(
      [
        'CASH_TO_APPROVE',
        'HELD_BILLS',
        'MOVEMENTS_UNPOSTED',
        'SAFE_NOT_COUNTED',
        'SAFE_OVER_INSURED',
        'SESSIONS_LIVE',
        'SESSIONS_PENDING_APPROVAL',
        'SLIP_GAPS',
        'VARIANCE_UNDECIDED',
      ].sort(),
    );
    expect(got.items.find((i) => i.code === 'SESSIONS_LIVE')).toEqual(
      expect.objectContaining({ tone: 'RED', count: 1, sessionIds: [live.tssId] }),
    );
    // Notes 121 §3: the day X compares counted cash with the counted tills'
    // expected only — the live till's 500 float is in cash_expected, not there.
    const dayX = (await app.get(TillDayHeaderProvider).resolve(printCtx(day.tbdId, day.tbdAccYear))) as Record<
      string,
      number | null
    >;
    expect(dayX.cash_expected! - dayX.cash_expected_counted!).toBe(500);
    expect(got.items.find((i) => i.code === 'CASH_TO_APPROVE')!.tone).toBe('GREEN');
    expect(got).toEqual(expect.objectContaining({ canClose: false, canCloseWithException: true }));

    const blocked = await postAs('prathap', officePc, 'days/close', dayKey(day));
    expectStatus(blocked, 409);
    expect(firstError(blocked)).toEqual(
      expect.objectContaining({
        code: 'TILL_DAY_CLOSE_BLOCKED',
        items: [expect.objectContaining({ code: 'SESSIONS_LIVE' })],
      }),
    );
    await closeSession(live);
    // its cash awaits approval: RED until approved
    const waiting = data<{ items: { code: string; tone: string }[]; canClose: boolean }>(
      await getAs('prathap', officePc, 'days/close-check', dayKey(day)),
    );
    expect(waiting.items.find((i) => i.code === 'CASH_TO_APPROVE')!.tone).toBe('RED');
    expect(waiting.canClose).toBe(false);
    expectStatus(
      await postAs('prathap', officePc, 'sessions/approve-cash', {
        ...key(live),
        approverPin: '2468',
      }),
      200,
    );
  });

  it('a clean close: totals frozen, the store Z; no session opens on it, none of it reopens', async () => {
    const check = data<{ canClose: boolean }>(
      await getAs('prathap', officePc, 'days/close-check', dayKey(day)),
    );
    expect(check.canClose).toBe(true);
    const res = await postAs('prathap', officePc, 'days/close', { ...dayKey(day), notes: 'e2e' });
    expectStatus(res, 200);
    const got = data<{
      zNo: number;
      tapId: string | null;
      day: { tbdStatus: string; tbdZNo: number; totals: { sessionCount: number } };
    }>(res);
    zNo = got.zNo;
    expect(got.tapId).toBeNull();
    expect(got.day).toEqual(
      expect.objectContaining({
        tbdStatus: 'CLOSED',
        tbdZNo: zNo,
        totals: expect.objectContaining({ sessionCount: 3 }),
      }),
    );
    const again = await postAs('prathap', officePc, 'days/close', dayKey(day));
    expectStatus(again, 409);
    expect(firstError(again).code).toBe('TILL_DAY_CLOSED');

    const open = await postAs('tester1', tillPc, 'sessions/open', {
      ...scope(),
      floatMode: 'ISSUED',
      floatIssued: 500,
      lines: notes500(1),
    });
    expectStatus(open, 409);
    expect(firstError(open).code).toBe('TILL_DAY_NOT_OPEN');

    const [one] = await prisma.$queryRaw<{ id: string; y: string }[]>`
      SELECT tss_id::text AS id, tss_acc_year AS y FROM accounts.till_session
       WHERE tss_day_id = ${day.tbdId}::uuid ORDER BY tss_opened_on DESC LIMIT 1`;
    const reopen = await postAs('prathap', officePc, 'sessions/reopen', {
      ...key({ tssId: one.id, tssAccYear: one.y }),
      reasonId: reasons['REOPEN.COUNT_ERROR'],
      approverPin: '2468',
      notes: 'e2e',
    });
    expectStatus(reopen, 409);
    expect(firstError(reopen).code).toBe('TILL_DAY_CLOSED');
  });

  it('the print providers read the closed day and its sessions', async () => {
    const ctx = (docId: string) => printCtx(docId, day.tbdAccYear);
    const header = (await app.get(TillDayHeaderProvider).resolve(ctx(day.tbdId))) as Record<
      string,
      unknown
    >;
    expect(header).toEqual(
      expect.objectContaining({ status: 'CLOSED', is_closed: true, z_no: zNo, session_count: 3 }),
    );
    // Notes 121: 12-hour times; the closed day's expected is its counted
    // sessions'; the safe block (not counted here: the setting is off)
    expect(header.closed_on).toMatch(/^\d{2}-\d{2}-\d{4} (0\d|1[0-2]):\d{2} (AM|PM)$/);
    expect(header.cash_expected_counted).toBe(header.cash_expected);
    expect(header).toEqual(
      expect.objectContaining({
        safe_counted: null,
        safe_difference: null,
        safe_remitted: 0,
        safe_in_transit: 0,
      }),
    );
    expect(typeof header.safe_opening).toBe('number');
    const [one] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT tss_id::text AS id FROM accounts.till_session
       WHERE tss_day_id = ${day.tbdId}::uuid AND tss_force_closed`;
    const s = (await app.get(TillSessionHeaderProvider).resolve(ctx(one.id))) as Record<
      string,
      unknown
    >;
    expect(s).toEqual(
      expect.objectContaining({
        status: 'CLOSED',
        force_closed: true,
        force_reason: 'Shift over time',
        x_no: 2,
        cash_counted: 500,
        // the supervisor counted exactly the float: no gap to book
        variance_treatment: null,
      }),
    );
    expect(s.opened_on).toMatch(/^\d{2}-\d{2}-\d{4} (0\d|1[0-2]):\d{2} (AM|PM)$/);
  });

  it('reopen: refused under a later closed day; else OPEN, the Z kept, closed again under it', async () => {
    const reopen = (who: string, extra: object = {}) =>
      postAs(who, officePc, 'days/reopen', {
        ...dayKey(day),
        reasonId: reasons['DAY_REOPEN.CORRECTION'],
        notes: 'e2e',
        ...extra,
      });
    // a later day of the branch, closed
    const [later] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO accounts.till_business_day
        (tbd_company_id, tbd_branch_id, tbd_acc_year, tbd_business_date, tbd_status, tbd_opened_by,
         tbd_closed_on, tbd_closed_by, tbd_created_by)
      SELECT tbd_company_id, tbd_branch_id, tbd_acc_year, tbd_business_date + 1, 'CLOSED', tbd_opened_by,
             now(), tbd_opened_by, 'e2e-dayclose'
        FROM accounts.till_business_day WHERE tbd_id = ${day.tbdId}::uuid
      RETURNING tbd_id::text AS id`;
    const refused = await reopen('tester1');
    expectStatus(refused, 409);
    expect(firstError(refused).code).toBe('TILL_DAY_LATER_CLOSED');
    await prisma.$executeRaw`DELETE FROM accounts.till_business_day WHERE tbd_id = ${later.id}::uuid`;

    // prathap closed it: he may not reopen it (the requester); tester1 may, remotely
    const self = await reopen('prathap', { approverPin: '2468' });
    expectStatus(self, 403);
    const res = await reopen('tester1');
    expectStatus(res, 200);
    expect(
      data<{
        day: {
          tbdStatus: string;
          tbdZNo: number;
          tbdReopenCount: number;
          totals: { sessionCount: number };
        };
      }>(res).day,
    ).toEqual(
      expect.objectContaining({
        tbdStatus: 'OPEN',
        tbdZNo: zNo,
        tbdReopenCount: 1,
        totals: expect.objectContaining({ sessionCount: 0 }),
      }),
    );
  });

  it('closed over a live session by exception: a count each, a second approver, the hand-over received', async () => {
    const live = await openSession();
    const close = (who: string, exception: object) =>
      postAs(who, officePc, 'days/close', { ...dayKey(day), notes: 'e2e', exception });
    const exception = {
      reasonId: reasons['DAY_CLOSE.CASHIER_GONE'],
      approverId: TESTER,
      approverPin: '1357',
    };
    const noCount = await close('prathap', exception);
    expectStatus(noCount, 422);
    expect(firstError(noCount).code).toBe('TILL_FORCE_COUNT_REQUIRED');
    const counts = [{ tssId: live.tssId, lines: notes500(1), floatLeft: 0 }];
    const self = await close('prathap', {
      ...exception,
      approverId: null,
      approverPin: '2468',
      counts,
    });
    expectStatus(self, 403);
    expect(firstError(self).code).toBe('TILL_APPROVER_SELF');
    const short = await close('prathap', {
      ...exception,
      counts: [
        { tssId: live.tssId, lines: [{ tenderTypeId: 1, denominationId: note100, qty: 2 }] },
      ],
    });
    expectStatus(short, 409);
    expect(firstError(short).code).toBe('TILL_DAY_CLOSE_BLOCKED');
    const [still] = await prisma.$queryRaw<{ status: string }[]>`
      SELECT tss_status AS status FROM accounts.till_session WHERE tss_id = ${live.tssId}::uuid`;
    expect(still.status).toBe('OPEN');

    const res = await close('prathap', { ...exception, counts });
    expectStatus(res, 200);
    const got = data<{
      zNo: number;
      tapId: string;
      closedOver: { code: string }[];
      forceClosed: { tssId: string }[];
      day: { tbdStatus: string; tbdExceptionCount: number };
    }>(res);
    expect(got).toEqual(
      expect.objectContaining({
        zNo,
        closedOver: [expect.objectContaining({ code: 'SESSIONS_LIVE' })],
        forceClosed: [expect.objectContaining({ tssId: live.tssId })],
        day: expect.objectContaining({ tbdStatus: 'CLOSED', tbdExceptionCount: 1 }),
      }),
    );
    expect(await handOver(live)).toEqual(
      expect.objectContaining({ receipt: 'RECEIVED', by: PRATHAP }),
    );
    const [approval] = await prisma.$queryRaw<{ event: string; req: string; by: string }[]>`
      SELECT tap_event_code AS event, tap_requested_by::text AS req, tap_decided_by::text AS by
        FROM accounts.till_approval WHERE tap_id = ${got.tapId}::uuid`;
    expect(approval).toEqual({ event: 'DAY_CLOSE_EXCEPTION', req: PRATHAP, by: TESTER });
    const [forced] = await prisma.$queryRaw<{ forced: boolean; reason: string }[]>`
      SELECT s.tss_force_closed AS forced, r.trs_code AS reason
        FROM accounts.till_session s JOIN accounts.till_reason r ON r.trs_id = s.tss_force_reason_id
       WHERE s.tss_id = ${live.tssId}::uuid`;
    expect(forced).toEqual({ forced: true, reason: 'DAY_CLOSE' });
  });
});
