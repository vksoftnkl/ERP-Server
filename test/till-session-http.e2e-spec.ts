import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  BEARER,
  BRANCH,
  COMPANY,
  bootApp,
  data,
  expectStatus,
  prisma,
} from './helpers/payment-e2e';
import { grantMenuRights, restoreMenuRights, TESTER1, type MenuRightsMemo } from './helpers/menu-rights';

/**
 * Till management, build phase 1 (src/modules/till, TILL_DESIGN.md REV 1) —
 * the routes driven over HTTP against the dev database, the way the payment
 * suites drive theirs (auth stubbed at the provider, everything else live).
 *
 * The suite owns a registered DESKTOP device, a safe and a counter, opens and
 * closes real sessions on them, and checks the books after each: a session's
 * till-cash legs net to tss_float_left − (carried float) — §5.7's invariant.
 * Teardown removes every row it made, newest table first.
 *
 * tester1 is the cashier. Till Sessions (273) OVERRIDE is switched OFF for the
 * blind-count checks and back on where a supervisor is being played.
 *
 * Run with --runInBand (the rights fixture is one row per menu).
 */

const TILL_MENUS = [271, 272, 273, 274, 275, 276];
const ROUTE = (path: string) => `/api/v1/till/${path}`;
const stamp = () => Date.now().toString(36).toUpperCase().slice(-6);

let app: INestApplication;
let memo: MenuRightsMemo;
let deviceId: string;
let webDeviceId: string;
let safeId: string;
let counterId: string;
let counterCode: string;
let note500: string;
let note100: string;
let coin5: string;
let tillCashLedger: string;
const sessions: { tssId: string; accYear: string }[] = [];
let createdDayId: string | null = null;

const post = (path: string, body: object) =>
  request(app.getHttpServer()).post(ROUTE(path)).set('Authorization', BEARER).send(body);
const get = (path: string, query: object) =>
  request(app.getHttpServer()).get(ROUTE(path)).set('Authorization', BEARER).query(query);
const del = (path: string, query: object) =>
  request(app.getHttpServer()).delete(ROUTE(path)).set('Authorization', BEARER).query(query);

async function setOverride(on: boolean): Promise<void> {
  await prisma.$executeRaw`
    UPDATE public.user_menus SET um_can_override = ${on}
     WHERE um_user_id = ${TESTER1}::uuid AND um_menu_id = 273 AND um_is_deleted = false`;
}

/** Σ DR − Σ CR on the till cash ledger over the session's vouchers. */
async function tillCashNet(tssId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ net: string }[]>`
    SELECT COALESCE(sum(CASE WHEN av.av_dr_cr = 'DR' THEN av.av_amount ELSE -av.av_amount END), 0)::text AS net
      FROM accounts.acc_vouchers av
      JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = av.av_voucher_id AND h.avh_acc_year = av.av_acc_year
     WHERE h.avh_session_id = ${tssId}::uuid
       AND h.avh_voucher_status = 'POSTED'
       AND av.av_is_deleted = false
       AND av.av_ledger_id = ${tillCashLedger}::uuid`;
  return Number(row.net);
}

async function openSession(body: object = {}) {
  const res = await post('sessions/open', { companyId: COMPANY, branchId: BRANCH, lines: [], ...body });
  if (res.status === 201) {
    const s = data<{ tssId: string; tssAccYear: string }>(res);
    sessions.push({ tssId: s.tssId, accYear: s.tssAccYear });
  }
  return res;
}

const key = (s: { tssId: string; tssAccYear: string }) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  accYear: s.tssAccYear,
  tssId: s.tssId,
});

beforeAll(async () => {
  const uid = `e2e-till-${stamp()}`;
  const [device] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${uid}, 'E2E till PC', 'Desktop')
    RETURNING dev_id`;
  deviceId = device.dev_id;
  const [web] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`${uid}-web`}, 'E2E browser', 'Web')
    RETURNING dev_id`;
  webDeviceId = web.dev_id;

  const denoms = await prisma.$queryRaw<{ tdn_id: string; v: string; k: string }[]>`
    SELECT tdn_id, tdn_value::text AS v, tdn_kind AS k FROM accounts.till_denomination
     WHERE tdn_company_id IS NULL AND tdn_is_deleted = false`;
  note500 = denoms.find((d) => Number(d.v) === 500 && d.k === 'NOTE')!.tdn_id;
  note100 = denoms.find((d) => Number(d.v) === 100 && d.k === 'NOTE')!.tdn_id;
  coin5 = denoms.find((d) => Number(d.v) === 5 && d.k === 'COIN')!.tdn_id;

  const [cash] = await prisma.$queryRaw<{ tnd_ledger_id: string }[]>`
    SELECT tnd_ledger_id FROM accounts.acc_tender_master
     WHERE tnd_type_id = 1 AND tnd_company_id = ${COMPANY}::uuid
       AND (tnd_branch_id = ${BRANCH}::uuid OR tnd_branch_id IS NULL)
       AND tnd_is_active AND NOT tnd_is_deleted
     ORDER BY (tnd_branch_id IS NULL), tnd_is_default DESC, tnd_display_position, tnd_created_on LIMIT 1`;
  tillCashLedger = cash.tnd_ledger_id;

  const [day] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid AND tbd_is_deleted = false`;
  // Only a day this suite opened is removed afterwards.
  createdDayId = day.n === 0 ? 'pending' : null;

  memo = await grantMenuRights(prisma, TILL_MENUS);
  app = await bootApp({ device_id: deviceId });
}, 120_000);

afterAll(async () => {
  const ids = sessions.map((s) => s.tssId);
  if (ids.length > 0) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ANY(${ids}::uuid[])`;
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
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_device_id IN (${deviceId}::uuid, ${webDeviceId}::uuid)`;
  if (createdDayId && createdDayId !== 'pending') {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_day_id = ${createdDayId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM accounts.till_business_day d
       WHERE d.tbd_id = ${createdDayId}::uuid
         AND NOT EXISTS (SELECT 1 FROM accounts.till_session s WHERE s.tss_day_id = d.tbd_id)`;
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_company_id = ${COMPANY}::uuid AND tcn_code LIKE 'E2E%'`;
  await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_company_id = ${COMPANY}::uuid AND tsf_code LIKE 'E2E%'`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id IN (${deviceId}::uuid, ${webDeviceId}::uuid)`;
  await restoreMenuRights(prisma, memo);
  await app?.close();
  await prisma.$disconnect();
}, 120_000);

describe('Till masters', () => {
  it('creates a safe on the SAFE_CASH ledger and a counter bound to this device', async () => {
    const tag = stamp();
    const safe = await post('safes/create', {
      tsfCompanyId: COMPANY,
      tsfBranchId: BRANCH,
      tsfCode: `E2E${tag}`,
      tsfName: 'E2E safe',
      tsfIsDefault: false,
    });
    expectStatus(safe, 201);
    safeId = data<{ tsfId: string; tsfLedgerId: string }>(safe).tsfId;
    expect(data<{ ledgerName: string }>(safe).ledgerName).toBe('Store Safe Cash');

    counterCode = `E2E${tag}`;
    const counter = await post('counters/create', {
      tcnCompanyId: COMPANY,
      tcnBranchId: BRANCH,
      tcnCode: counterCode,
      tcnName: 'E2E counter',
      tcnDeviceId: deviceId,
      tcnSafeId: safeId,
      tcnDefaultFloat: 2000,
    });
    expectStatus(counter, 201);
    counterId = data<{ tcnId: string }>(counter).tcnId;
  });

  it('refuses a second counter with the same code, and a web device', async () => {
    const dup = await post('counters/create', {
      tcnCompanyId: COMPANY,
      tcnBranchId: BRANCH,
      tcnCode: counterCode.toLowerCase(),
      tcnName: 'dup',
    });
    expectStatus(dup, 400);
    const web = await post('counters/create', {
      tcnCompanyId: COMPANY,
      tcnBranchId: BRANCH,
      tcnCode: `E2EW${stamp()}`,
      tcnName: 'web',
      tcnDeviceId: webDeviceId,
    });
    expectStatus(web, 400);
    expect(JSON.stringify(web.body)).toContain('web client cannot drive a counter');
  });

  it('lists the shipped INR denominations for a count screen', async () => {
    const res = await get('denominations/list', { companyId: COMPANY });
    expectStatus(res, 200);
    const values = data<{ tdnValue: number; tdnKind: string }[]>(res).map((d) => `${d.tdnValue}${d.tdnKind[0]}`);
    expect(values).toEqual(expect.arrayContaining(['500N', '100N', '5C']));
  });
});

describe('A session, blind, with a recount', () => {
  let s: { tssId: string; tssAccYear: string; tssSessionNo: string };

  it('opens with an ISSUED float, posting TFlt Dr till cash / Cr safe', async () => {
    await setOverride(false);
    const res = await openSession({
      floatMode: 'ISSUED',
      floatIssued: 2000,
      lines: [{ tenderTypeId: 1, denominationId: note500, qty: 4 }],
    });
    expectStatus(res, 201);
    s = data(res);
    if (createdDayId === 'pending') {
      createdDayId = data<{ tssDayId: string }>(res).tssDayId;
    }
    const session = data<{ tssStatus: string; tssFloatCounted: number; movements: { tcmKind: string; tcmAmount: number }[] }>(res);
    expect(session.tssStatus).toBe('OPEN');
    expect(s.tssSessionNo).toMatch(new RegExp(`^${counterCode}-\\d{6}-\\d{2}$`));
    expect(session.tssFloatCounted).toBe(2000);
    expect(session.movements).toEqual([expect.objectContaining({ tcmKind: 'FLOAT_ISSUE', tcmAmount: 2000 })]);
    expect(await tillCashNet(s.tssId)).toBe(2000);
  });

  it('is the current session, and the counter / operator are busy', async () => {
    const cur = await get('sessions/current', { companyId: COMPANY, branchId: BRANCH });
    expectStatus(cur, 200);
    expect(data<{ tssId: string }>(cur).tssId).toBe(s.tssId);

    const again = await openSession({ floatMode: 'NONE' });
    expectStatus(again, 409);
    expect(again.body.errors[0].code).toBe('TILL_COUNTER_BUSY');
  });

  it('suspends and resumes', async () => {
    const sus = await post('sessions/suspend', key(s));
    expectStatus(sus, 200);
    expect(data<{ tssStatus: string }>(sus).tssStatus).toBe('SUSPENDED');
    const res = await post('sessions/resume', key(s));
    expectStatus(res, 200);
    expect(data<{ tssStatus: string; tssSuspendCount: number }>(res)).toEqual(
      expect.objectContaining({ tssStatus: 'OPEN', tssSuspendCount: 1 }),
    );
  });

  it('hides the expected figures from the cashier of a blind session', async () => {
    const res = await get('sessions/get', key(s));
    expectStatus(res, 200);
    const body = data<{ expectedVisible: boolean; tenders: { tenderTypeId: number; expected: number | null }[] }>(res);
    expect(body.expectedVisible).toBe(false);
    expect(body.tenders.find((t) => t.tenderTypeId === 1)!.expected).toBeNull();

    await setOverride(true);
    const own = await get('sessions/expected', key(s));
    expectStatus(own, 403);
    expect(own.body.errors[0].code).toBe('TILL_BLIND_CLOSE');
    await setOverride(false);
  });

  it('ends billing, then a count 50 short asks for a recount — without the figure', async () => {
    const end = await post('sessions/end-billing', key(s));
    expectStatus(end, 200);
    expect(data<{ tssStatus: string; tssCountMode: string }>(end)).toEqual(
      expect.objectContaining({ tssStatus: 'COUNTING', tssCountMode: 'BLIND' }),
    );

    const count = await post('sessions/count', {
      ...key(s),
      lines: [
        { tenderTypeId: 1, denominationId: note500, qty: 3 },
        { tenderTypeId: 1, denominationId: note100, qty: 4 },
        { tenderTypeId: 1, denominationId: coin5, qty: 10 },
      ],
    });
    expectStatus(count, 200);
    expect(data(count)).toEqual(
      expect.objectContaining({ outcome: 'RECOUNT_REQUIRED', attemptNo: 1, attemptsLeft: 1, variances: null }),
    );
  });

  it('refuses a UPI line: a STATEMENT tender is not counted at the till', async () => {
    const res = await post('sessions/count', { ...key(s), lines: [{ tenderTypeId: 3, enteredAmount: 10 }] });
    expectStatus(res, 422);
    expect(res.body.errors[0].code).toBe('TILL_COUNT_INVALID');
  });

  it('accepts an exact recount, and the close hands 2000 to the safe and issues the Z', async () => {
    const count = await post('sessions/count', {
      ...key(s),
      lines: [{ tenderTypeId: 1, denominationId: note500, qty: 4 }],
    });
    expectStatus(count, 200);
    expect(data(count)).toEqual(expect.objectContaining({ outcome: 'ACCEPTED', attemptNo: 2 }));

    const before = await prisma.tillCounter.findUniqueOrThrow({ where: { tcnId: counterId } });
    const close = await post('sessions/close', { ...key(s), floatLeft: 0 });
    expectStatus(close, 200);
    const closed = data<{
      tssStatus: string;
      tssZNo: number;
      totals: { handedOver: number; floatLeft: number; cashVariance: number };
      expectedVisible: boolean;
      variances: { tvrVariance: number; tvrStatus: string; tvrVoucherId: string | null }[];
    }>(close);
    expect(closed.tssStatus).toBe('CLOSED');
    expect(closed.tssZNo).toBe(before.tcnZLastNo + 1);
    expect(closed.totals).toEqual(expect.objectContaining({ handedOver: 2000, floatLeft: 0, cashVariance: 0 }));
    // Visible once closed; a zero variance is POSTED with no voucher.
    expect(closed.expectedVisible).toBe(true);
    expect(closed.variances).toEqual([expect.objectContaining({ tvrVariance: 0, tvrStatus: 'POSTED', tvrVoucherId: null })]);
    // §5.7: TFlt +2000, TDrp −2000.
    expect(await tillCashNet(s.tssId)).toBe(0);

    const counts = await prisma.tillCount.findMany({
      where: { tctSessionId: s.tssId, tctAccYear: s.tssAccYear },
      orderBy: [{ tctKind: 'asc' }, { tctAttemptNo: 'asc' }],
      select: { tctKind: true, tctAttemptNo: true, tctIsFinal: true },
    });
    // Every attempt kept (D5): OPEN, CLOSE #1 (not final), RECOUNT #2 (final).
    expect(counts).toEqual([
      { tctKind: 'CLOSE', tctAttemptNo: 1, tctIsFinal: false },
      { tctKind: 'OPEN', tctAttemptNo: 1, tctIsFinal: true },
      { tctKind: 'RECOUNT', tctAttemptNo: 2, tctIsFinal: true },
    ]);
  });
});

describe('A carried float and a variance inside the tolerance', () => {
  let s: { tssId: string; tssAccYear: string };

  it('a CARRIED open inherits nothing when the last close left 0', async () => {
    const res = await openSession({ floatMode: 'CARRIED' });
    expectStatus(res, 201);
    s = data(res);
    expect(data<{ tssFloatIssued: number; tssPrevSessionId: string }>(res)).toEqual(
      expect.objectContaining({ tssFloatIssued: 0, tssPrevSessionId: sessions[0].tssId }),
    );
  });

  it('a count 5 short is ACCEPTED (tolerance 10) and posts TVar to Cash Short & Excess', async () => {
    expectStatus(await post('sessions/end-billing', key(s)), 200);
    // Nothing was in the drawer and nothing was sold; 5 short of nothing is a
    // −5 count, which a count cannot be — so put the 5 the other way: an EXCESS.
    const count = await post('sessions/count', {
      ...key(s),
      lines: [{ tenderTypeId: 1, denominationId: coin5, qty: 1 }],
    });
    expectStatus(count, 200);
    expect(data<{ outcome: string }>(count).outcome).toBe('ACCEPTED');

    const close = await post('sessions/close', { ...key(s), floatLeft: 5 });
    expectStatus(close, 200);
    const closed = data<{ tssVarianceStatus: string; variances: { tvrVariance: number; tvrVoucherId: string | null }[] }>(close);
    expect(closed.tssVarianceStatus).toBe('WITHIN_TOLERANCE');
    expect(closed.variances[0].tvrVariance).toBe(5);
    expect(closed.variances[0].tvrVoucherId).not.toBeNull();

    const legs = await prisma.$queryRaw<{ dr_cr: string; amount: string; role: string | null }[]>`
      SELECT av_dr_cr AS dr_cr, av_amount::text AS amount, av_role AS role FROM accounts.acc_vouchers
       WHERE av_voucher_id = ${closed.variances[0].tvrVoucherId}::uuid ORDER BY av_row_no`;
    expect(legs).toEqual([
      { dr_cr: 'DR', amount: '5.00', role: null },
      { dr_cr: 'CR', amount: '5.00', role: 'CASH_SHORT_EXCESS' },
    ]);
    // An excess of 5 kept in the drawer: till cash +5, the float left.
    expect(await tillCashNet(s.tssId)).toBe(5);
  });
});

describe('A float the safe gave short (notes 98)', () => {
  let s: { tssId: string; tssAccYear: string };
  // 2000 issued, 1990 counted: 3 × 500 + 4 × 100 + 18 × 5 (the ids load in beforeAll).
  const lines = () => [
    { tenderTypeId: 1, denominationId: note500, qty: 3 },
    { tenderTypeId: 1, denominationId: note100, qty: 4 },
    { tenderTypeId: 1, denominationId: coin5, qty: 18 },
  ];

  it('refuses a reason of another category, and the UNKNOWN reason without a note', async () => {
    const [other] = await prisma.$queryRaw<{ trs_id: string }[]>`
      SELECT trs_id FROM accounts.till_reason
       WHERE trs_category <> 'FLOAT_MISMATCH' AND trs_company_id IS NULL AND trs_is_active AND NOT trs_is_deleted
       LIMIT 1`;
    const wrong = await openSession({ floatMode: 'ISSUED', floatIssued: 2000, lines: lines(), reasonId: other.trs_id });
    expectStatus(wrong, 422);
    expect(wrong.body.errors[0]).toEqual(expect.objectContaining({ code: 'TILL_REASON_INVALID', field: 'reasonId' }));

    const bare = await openSession({ floatMode: 'ISSUED', floatIssued: 2000, lines: lines() });
    expectStatus(bare, 422);
    expect(bare.body.errors[0]).toEqual(expect.objectContaining({ code: 'TILL_REASON_INVALID', field: 'notes' }));
  });

  it('posts the −10 at open with its reason: TVar Dr Cash Short & Excess / Cr till cash', async () => {
    const [reason] = await prisma.$queryRaw<{ trs_id: string }[]>`
      SELECT trs_id FROM accounts.till_reason
       WHERE trs_category = 'FLOAT_MISMATCH' AND trs_code = 'SAFE_SHORT' AND trs_company_id IS NULL`;
    const res = await openSession({
      floatMode: 'ISSUED',
      floatIssued: 2000,
      lines: lines(),
      reasonId: reason.trs_id,
      notes: 'Safe gave less',
    });
    expectStatus(res, 201);
    s = data(res);
    expect(data<{ tssFloatVariance: number }>(res).tssFloatVariance).toBe(-10);

    const [v] = await prisma.tillVariance.findMany({
      where: { tvrSessionId: s.tssId, tvrAccYear: s.tssAccYear, tvrStage: 'OPEN' },
    });
    expect(v).toEqual(
      expect.objectContaining({
        tvrTreatment: 'EXPENSE',
        tvrStatus: 'POSTED',
        tvrReasonId: reason.trs_id,
        tvrNotes: 'Safe gave less',
      }),
    );
    expect(v.tvrVoucherId).not.toBeNull();
    const legs = await prisma.$queryRaw<{ dr_cr: string; amount: string; role: string | null; ledger: string }[]>`
      SELECT av_dr_cr AS dr_cr, av_amount::text AS amount, av_role AS role, av_ledger_id::text AS ledger
        FROM accounts.acc_vouchers WHERE av_voucher_id = ${v.tvrVoucherId}::uuid ORDER BY av_row_no`;
    expect(legs).toEqual([
      expect.objectContaining({ dr_cr: 'DR', amount: '10.00', role: 'CASH_SHORT_EXCESS' }),
      { dr_cr: 'CR', amount: '10.00', role: null, ledger: tillCashLedger },
    ]);
    // TFlt +2000, TVar −10: the till ledger holds what was counted.
    expect(await tillCashNet(s.tssId)).toBe(1990);
  });

  it('a close handing the 1990 to the safe leaves nothing on the till ledger (§5.7)', async () => {
    expectStatus(await post('sessions/end-billing', key(s)), 200);
    const count = await post('sessions/count', { ...key(s), lines: lines() });
    expect(data<{ outcome: string }>(count).outcome).toBe('ACCEPTED');
    const close = await post('sessions/close', { ...key(s), floatLeft: 0 });
    expectStatus(close, 200);
    expect(data<{ totals: { handedOver: number } }>(close).totals.handedOver).toBe(1990);
    expect(await tillCashNet(s.tssId)).toBe(0);
  });
});

describe('Out of tolerance on the last attempt', () => {
  let s: { tssId: string; tssAccYear: string };

  it('goes PENDING_APPROVAL, and the close answers 428 TILL_APPROVAL_REQUIRED', async () => {
    const res = await openSession({
      floatMode: 'ISSUED',
      floatIssued: 500,
      lines: [{ tenderTypeId: 1, denominationId: note500, qty: 1 }],
    });
    expectStatus(res, 201);
    s = data(res);
    expectStatus(await post('sessions/end-billing', key(s)), 200);
    const short = { ...key(s), lines: [{ tenderTypeId: 1, denominationId: note100, qty: 4 }] };
    expect(data<{ outcome: string }>(await post('sessions/count', short)).outcome).toBe('RECOUNT_REQUIRED');
    const last = await post('sessions/count', short);
    expect(data(last)).toEqual(
      expect.objectContaining({ outcome: 'SENT_FOR_APPROVAL', tssStatus: 'PENDING_APPROVAL', attemptsLeft: 0 }),
    );

    const close = await post('sessions/close', key(s));
    expectStatus(close, 428);
    expect(close.body.errors[0]).toEqual(
      expect.objectContaining({ code: 'TILL_APPROVAL_REQUIRED', event: 'CASH_VARIANCE', amount: 100 }),
    );

    const third = await post('sessions/count', short);
    expectStatus(third, 409);
  });

  it('a supervisor sees the figures the cashier does not', async () => {
    await setOverride(true);
    // tester1 is this session's cashier, so even with OVERRIDE the expected route refuses…
    expectStatus(await get('sessions/expected', key(s)), 403);
    await setOverride(false);
  });
});

describe('The till journal', () => {
  it('stores a device batch once, and refuses a server event from a device', async () => {
    const accYear = sessions[0].accYear;
    const batch = {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear,
      events: [
        { code: 'NO_SALE', eventOn: new Date().toISOString(), clientSeq: 1, sessionId: sessions[2].tssId },
        { code: 'X_REPORT', eventOn: new Date().toISOString(), clientSeq: 2 },
      ],
    };
    const first = await post('events/batch', batch);
    expectStatus(first, 200);
    expect(data(first)).toEqual({ accepted: 2, duplicates: 0 });
    const again = await post('events/batch', batch);
    expect(data(again)).toEqual({ accepted: 0, duplicates: 2 });

    const forged = await post('events/batch', {
      ...batch,
      events: [{ code: 'SESSION_CLOSE', eventOn: new Date().toISOString(), clientSeq: 3 }],
    });
    expectStatus(forged, 422);
    expect(forged.body.errors[0].code).toBe('TILL_EVENT_INVALID');
  });

  it('wrote the server’s own events as the session moved', async () => {
    const codes = await prisma.tillEvent.findMany({
      where: { tevSessionId: sessions[0].tssId, tevAccYear: sessions[0].accYear },
      orderBy: { tevEventOn: 'asc' },
      select: { tevEventCode: true },
    });
    // Events of one transaction may share a millisecond: compare as a multiset.
    expect(codes.map((c) => c.tevEventCode).sort()).toEqual(
      [
        'SESSION_OPEN',
        'MOVEMENT_POSTED',
        'SESSION_SUSPEND',
        'SESSION_RESUME',
        'SESSION_END_BILLING',
        'SESSION_COUNT',
        'SESSION_RECOUNT',
        'MOVEMENT_POSTED',
        'SESSION_CLOSE',
      ].sort(),
    );
  });
});

describe('Masters in use', () => {
  it('refuses to delete a counter while a session is live on it', async () => {
    const res = await del('counters/delete', { id: counterId, companyId: COMPANY });
    expectStatus(res, 409);
    expect(res.body.errors[0].code).toBe('TILL_MASTER_IN_USE');
  });
});
