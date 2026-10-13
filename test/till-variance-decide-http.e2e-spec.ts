import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { hashSecret } from '../src/common/utils/secret-hash.utils';
import { as, bootIdentityApp, PRATHAP } from './helpers/identity-app';
import {
  grantMenuRights,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import { BRANCH, COMPANY, data, expectStatus, prisma } from './helpers/payment-e2e';

/**
 * Notes 105 Part A — deciding a PENDING_APPROVAL session's variance over
 * POST /till/sessions/decide-variance, against the dev database.
 *
 *   A2  who may: the cashier never (TILL_APPROVER_SELF, even a SUPER ADMIN);
 *       no 285 grant (TILL_APPROVER_NO_GRANT); a grant whose ceiling is below
 *       the gap (TILL_APPROVER_LIMIT); the EITHER channel with no remote
 *       authority wants the till PIN, and a wrong one is journalled PIN_FAIL
 *       (TILL_APPROVER_PIN)
 *   A1  RECOUNT by PIN: back to COUNTING with one more attempt, the next count
 *       replaces the variances; APPROVE EXPENSE remotely: the variances carry
 *       it, the close posts TVar to Cash Short & Excess; RECOVER refused when
 *       the cashier has no staff ledger; SUSPENSE posts to Tender suspense
 *   A3  one till_approval row per decision (REJECTED for a recount, APPROVED)
 *
 * tester1 (SUPER ADMIN) is the cashier on the till PC; prathap (USER) the
 * approver, from the office PC. The suite owns its devices, safe, counter,
 * prathap's PIN and grant, and every session it opens.
 *
 *     npm run test:e2e -- till-variance-decide-http --runInBand
 */

jest.setTimeout(240_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285];
const tag = Date.now().toString(36).toUpperCase().slice(-6);
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
let tillPc: string;
let officePc: string;
let safeId: string;
let counterId: string;
let note500: string;
let note100: string;
let tillCashLedger: string;
let shortExcessLedger: string;
let suspenseLedger: string;
let countErrorReason: string;
let grantId: string | null = null;
const sessions: { tssId: string; tssAccYear: string }[] = [];

type Session = { tssId: string; tssAccYear: string };
const http = () => request(app.getHttpServer());
const postAs = (who: string, device: string, path: string, body: object) =>
  http().post(`/api/v1/till/${path}`).set('Authorization', as(who, device)).send(body);
const key = (s: Session) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  accYear: s.tssAccYear,
  tssId: s.tssId,
});
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};

/** Open on the till PC as tester1 with a 500 float, end billing, count 400 twice: PENDING_APPROVAL, gap 100 (tolerance 10). */
async function pendingSession(): Promise<Session> {
  const open = await postAs('tester1', tillPc, 'sessions/open', {
    companyId: COMPANY,
    branchId: BRANCH,
    floatMode: 'ISSUED',
    floatIssued: 500,
    lines: [{ tenderTypeId: 1, denominationId: note500, qty: 1 }],
  });
  expectStatus(open, 201);
  const s = data<Session>(open);
  sessions.push(s);
  expectStatus(await postAs('tester1', tillPc, 'sessions/end-billing', key(s)), 200);
  const short = { ...key(s), lines: [{ tenderTypeId: 1, denominationId: note100, qty: 4 }] };
  expect(
    data<{ outcome: string }>(await postAs('tester1', tillPc, 'sessions/count', short)).outcome,
  ).toBe('RECOUNT_REQUIRED');
  const last = await postAs('tester1', tillPc, 'sessions/count', short);
  expect(data<{ outcome: string; tssStatus: string }>(last)).toEqual(
    expect.objectContaining({ outcome: 'SENT_FOR_APPROVAL', tssStatus: 'PENDING_APPROVAL' }),
  );
  return s;
}

const decideAs = (who: string, s: Session, body: Record<string, unknown>) =>
  postAs(who, officePc, 'sessions/decide-variance', { ...key(s), note: 'e2e decision', ...body });

async function approvalRows(s: Session) {
  return prisma.$queryRaw<
    {
      status: string;
      requested_by: string;
      decided_by: string;
      amount: string;
      channel: string;
      event: string;
    }[]
  >`
    SELECT tap_status AS status, tap_requested_by::text AS requested_by, tap_decided_by::text AS decided_by,
           tap_amount::text AS amount, tap_channel AS channel, tap_event_code AS event
      FROM accounts.till_approval WHERE tap_session_id = ${s.tssId}::uuid ORDER BY tap_created_on`;
}

async function liveVariances(s: Session) {
  return prisma.$queryRaw<
    {
      treatment: string;
      status: string;
      approval_id: string | null;
      voucher_id: string | null;
      recovery: string | null;
    }[]
  >`
    SELECT tvr_treatment AS treatment, tvr_status AS status, tvr_approval_id::text AS approval_id,
           tvr_voucher_id::text AS voucher_id, tvr_recovery_ledger_id::text AS recovery
      FROM accounts.till_variance
     WHERE tvr_session_id = ${s.tssId}::uuid AND tvr_stage = 'CLOSE' AND tvr_is_deleted = false
     ORDER BY tvr_created_on`;
}

async function legsOf(voucherId: string) {
  return prisma.$queryRaw<{ dr_cr: string; ledger: string; amount: string }[]>`
    SELECT trim(av_dr_cr) AS dr_cr, av_ledger_id::text AS ledger, av_amount::text AS amount
      FROM accounts.acc_vouchers
     WHERE av_voucher_id = ${voucherId}::uuid AND av_is_deleted = false
     ORDER BY av_row_no`;
}

async function sessionRow(s: Session) {
  const [row] = await prisma.$queryRaw<
    {
      status: string;
      variance_status: string;
      close_approval_id: string | null;
      recounts_granted: number;
    }[]
  >`
    SELECT tss_status AS status, tss_variance_status AS variance_status,
           tss_close_approval_id::text AS close_approval_id, tss_recounts_granted::int AS recounts_granted
      FROM accounts.till_session WHERE tss_id = ${s.tssId}::uuid`;
  return row;
}

beforeAll(async () => {
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-decide-${tag}-${name}`}, ${`E2E ${name}`}, 'Desktop')
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
  shortExcessLedger = await roleLedger('CASH_SHORT_EXCESS');
  suspenseLedger = await roleLedger('TENDER_SUSPENSE');
  const [reason] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT trs_id::text AS id FROM accounts.till_reason
     WHERE trs_company_id IS NULL AND trs_category = 'VARIANCE' AND trs_code = 'COUNT_ERROR' AND NOT trs_is_deleted`;
  countErrorReason = reason.id;

  rights.push(await grantMenuRights(prisma, TILL_MENUS, TESTER1));
  rights.push(await grantMenuRights(prisma, TILL_MENUS, PRATHAP));
  app = await bootIdentityApp();

  const safe = await postAs('tester1', officePc, 'safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2ED${tag}`,
    tsfName: 'E2E decide safe',
    tsfIsDefault: false,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`E2ED${tag}`}, 'E2E decide counter', ${tillPc}::uuid, ${safeId}::uuid, 'e2e-decide')
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;
});

afterAll(async () => {
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
  if (grantId) {
    await prisma.$executeRaw`DELETE FROM accounts.till_approval_authority WHERE taa_id = ${grantId}::uuid`;
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

describe('A2 · who may decide', () => {
  let s: Session;

  it('the cashier never decides their own session, not even a SUPER ADMIN (TILL_APPROVER_SELF)', async () => {
    s = await pendingSession();
    const res = await decideAs('tester1', s, { decision: 'RECOUNT' });
    expectStatus(res, 403);
    expect(firstError(res)).toEqual(
      expect.objectContaining({ code: 'TILL_APPROVER_SELF', event: 'CASH_VARIANCE' }),
    );
  });

  it('a user with no approval authority grant (285) is refused, told the event and the level (TILL_APPROVER_NO_GRANT)', async () => {
    const res = await decideAs('prathap', s, { decision: 'RECOUNT' });
    expectStatus(res, 403);
    expect(firstError(res)).toEqual(
      expect.objectContaining({
        code: 'TILL_APPROVER_NO_GRANT',
        event: 'CASH_VARIANCE',
        requiredRole: 'SUPERVISOR',
      }),
    );
  });

  it('a grant whose ceiling is below the gap is refused, naming the ceiling (TILL_APPROVER_LIMIT)', async () => {
    const [grant] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO accounts.till_approval_authority
        (taa_user_id, taa_company_id, taa_branch_id, taa_role, taa_event_code, taa_max_amount, taa_can_remote, taa_created_by)
      VALUES (${PRATHAP}::uuid, ${COMPANY}::uuid, NULL, 'SUPERVISOR', 'CASH_VARIANCE', 50, false, 'e2e-decide')
      RETURNING taa_id::text AS id`;
    grantId = grant.id;
    const res = await decideAs('prathap', s, { decision: 'RECOUNT' });
    expectStatus(res, 403);
    expect(firstError(res)).toEqual(
      expect.objectContaining({ code: 'TILL_APPROVER_LIMIT', amount: 100, maxAmount: 50 }),
    );
  });

  it('EITHER with no remote authority wants the till PIN; a wrong PIN is refused and journalled PIN_FAIL', async () => {
    await prisma.$executeRaw`UPDATE accounts.till_approval_authority SET taa_max_amount = 1000 WHERE taa_id = ${grantId}::uuid`;
    const noPin = await decideAs('prathap', s, { decision: 'RECOUNT' });
    expectStatus(noPin, 403);
    expect(firstError(noPin)).toEqual(
      expect.objectContaining({ code: 'TILL_APPROVER_PIN', field: 'approverPin' }),
    );

    await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${await hashSecret('2468')} WHERE usr_id = ${PRATHAP}::uuid`;
    const wrong = await decideAs('prathap', s, { decision: 'RECOUNT', approverPin: '0000' });
    expectStatus(wrong, 403);
    expect(firstError(wrong).code).toBe('TILL_APPROVER_PIN');
    const [fails] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${s.tssId}::uuid AND tev_event_code = 'PIN_FAIL' AND tev_user_id = ${PRATHAP}::uuid`;
    expect(fails.n).toBe(1);
    expect((await sessionRow(s)).status).toBe('PENDING_APPROVAL');
  });

  it('the right PIN: RECOUNT sends the session back to COUNTING with one more attempt; the exact count replaces the variance and the session closes', async () => {
    const res = await decideAs('prathap', s, { decision: 'RECOUNT', approverPin: '2468' });
    expectStatus(res, 200);
    expect(data(res)).toEqual(
      expect.objectContaining({
        decision: 'RECOUNT',
        event: 'CASH_VARIANCE',
        amount: 100,
        requiredRole: 'SUPERVISOR',
        approverRole: 'SUPERVISOR',
        channel: 'COUNTER',
        treatment: null,
        session: expect.objectContaining({ tssStatus: 'COUNTING' }),
      }),
    );
    expect(await sessionRow(s)).toEqual(
      expect.objectContaining({ status: 'COUNTING', recounts_granted: 1, close_approval_id: null }),
    );
    expect(await approvalRows(s)).toEqual([
      expect.objectContaining({
        status: 'REJECTED',
        requested_by: TESTER1,
        decided_by: PRATHAP,
        amount: '100.00',
        channel: 'COUNTER',
      }),
    ]);

    const exact = await postAs('tester1', tillPc, 'sessions/count', {
      ...key(s),
      lines: [{ tenderTypeId: 1, denominationId: note500, qty: 1 }],
    });
    expectStatus(exact, 200);
    expect(data<{ outcome: string; attemptNo: number }>(exact)).toEqual(
      expect.objectContaining({ outcome: 'ACCEPTED', attemptNo: 3 }),
    );
    expect(await liveVariances(s)).toEqual([
      expect.objectContaining({ treatment: 'WITHIN_TOLERANCE' }),
    ]);
    const [superseded] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_variance
       WHERE tvr_session_id = ${s.tssId}::uuid AND tvr_is_deleted = true AND tvr_treatment = 'PENDING'`;
    expect(superseded.n).toBe(1);
    const close = await postAs('tester1', tillPc, 'sessions/close', key(s));
    expectStatus(close, 200);
    expect(data<{ tssStatus: string }>(close).tssStatus).toBe('CLOSED');
  });
});

describe('A1 / A3 · APPROVE', () => {
  it('EXPENSE by a remote grant: the variances take it, the session closes and posts TVar to Cash Short & Excess', async () => {
    const s = await pendingSession();
    await prisma.$executeRaw`UPDATE accounts.till_approval_authority SET taa_can_remote = true WHERE taa_id = ${grantId}::uuid`;
    const noReason = await decideAs('prathap', s, { decision: 'APPROVE', treatment: 'EXPENSE' });
    expectStatus(noReason, 422);
    expect(firstError(noReason)).toEqual(
      expect.objectContaining({ code: 'TILL_REASON_INVALID', field: 'reasonId' }),
    );

    const res = await decideAs('prathap', s, {
      decision: 'APPROVE',
      treatment: 'EXPENSE',
      reasonId: countErrorReason,
      note: 'Counting error, accepted',
    });
    expectStatus(res, 200);
    const d = data<{
      tapId: string;
      channel: string;
      treatment: string;
      session: { tssStatus: string; tssVarianceStatus: string };
    }>(res);
    expect(d).toEqual(
      expect.objectContaining({
        channel: 'REMOTE',
        treatment: 'EXPENSE',
        session: expect.objectContaining({ tssStatus: 'COUNTING', tssVarianceStatus: 'ACCEPTED' }),
      }),
    );
    expect(await sessionRow(s)).toEqual(
      expect.objectContaining({ status: 'COUNTING', close_approval_id: d.tapId }),
    );
    expect(await liveVariances(s)).toEqual([
      expect.objectContaining({ treatment: 'EXPENSE', status: 'OPEN', approval_id: d.tapId }),
    ]);
    expect(await approvalRows(s)).toEqual([
      expect.objectContaining({
        status: 'APPROVED',
        decided_by: PRATHAP,
        channel: 'REMOTE',
        event: 'CASH_VARIANCE',
      }),
    ]);

    const close = await postAs('tester1', tillPc, 'sessions/close', key(s));
    expectStatus(close, 200);
    const [posted] = await liveVariances(s);
    expect(posted.status).toBe('POSTED');
    expect(await legsOf(posted.voucher_id!)).toEqual([
      { dr_cr: 'DR', ledger: shortExcessLedger, amount: '100.00' },
      { dr_cr: 'CR', ledger: tillCashLedger, amount: '100.00' },
    ]);
  });

  it('RECOVER is refused while the cashier has no staff ledger; SUSPENSE posts to Tender suspense; a CLOSED session answers 409', async () => {
    const s = await pendingSession();
    const recover = await decideAs('prathap', s, {
      decision: 'APPROVE',
      treatment: 'RECOVER',
      reasonId: countErrorReason,
    });
    expectStatus(recover, 422);
    expect(firstError(recover)).toEqual(
      expect.objectContaining({ code: 'TILL_LEDGER_UNMAPPED', field: 'treatment' }),
    );
    expect((await sessionRow(s)).status).toBe('PENDING_APPROVAL');

    const res = await decideAs('prathap', s, {
      decision: 'APPROVE',
      treatment: 'SUSPENSE',
      reasonId: countErrorReason,
    });
    expectStatus(res, 200);
    expect(data<{ session: { tssVarianceStatus: string } }>(res).session.tssVarianceStatus).toBe(
      'INVESTIGATE',
    );
    const close = await postAs('tester1', tillPc, 'sessions/close', key(s));
    expectStatus(close, 200);
    const [posted] = await liveVariances(s);
    expect(await legsOf(posted.voucher_id!)).toEqual([
      { dr_cr: 'DR', ledger: suspenseLedger, amount: '100.00' },
      { dr_cr: 'CR', ledger: tillCashLedger, amount: '100.00' },
    ]);

    const again = await decideAs('prathap', s, { decision: 'RECOUNT' });
    expectStatus(again, 409);
    expect(firstError(again).code).toBe('TILL_SESSION_NOT_OPEN');
  });
});
