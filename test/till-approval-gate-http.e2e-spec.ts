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
 * Notes 124 §5 — the approval gate (notes 105 Part B), against the dev database.
 *
 *   approvals/request   PENDING; the same caller asking again for the same
 *                       document gets it back; decided at once at the counter
 *                       (approverId + approverPin); a rule that asks nothing
 *                       → 422 TILL_APPROVAL_INVALID (needed: false)
 *   approvals/decide    the requester never (TILL_APPROVER_SELF); APPROVE by
 *                       PIN; not PENDING → 409; past its expiry → 409 EXPIRED
 *   approvals/cancel    whoever asked; then 409
 *   approvals/pending   the inbox: requests, and a session out of tolerance,
 *                       with canDecide for the caller
 *   FLOAT_MISMATCH      at open: WARN (as shipped) opens and files a request
 *                       on the session, whose approval lands on the variance;
 *                       REFUSE (a DEVICE row on the suite's till PC) answers
 *                       428 naming the counter, a wrong approval 422, the
 *                       approved one opens and is used up
 *
 * tester1 (SUPER ADMIN) is the cashier on the till PC; prathap (USER) the
 * approver with a STORE_MANAGER grant on every event. The suite owns its
 * devices, safe, counter, prathap's PIN and grant, and every row it makes.
 *
 *     npm run test:e2e -- till-approval-gate-http --runInBand
 */

jest.setTimeout(240_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285];
const tag = Date.now().toString(36).toUpperCase().slice(-6);
const SETTING_TAG = 'e2e-approval-gate';
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
let tillPc: string;
let officePc: string;
let safeId: string;
let counterId: string;
let note500: string;
let note100: string;
let grantId: string;
const sessions: Session[] = [];
const approvals: string[] = [];

type Session = { tssId: string; tssAccYear: string };
type Approval = {
  tapId: string;
  tapAccYear: string;
  status: string;
  event: string;
  amount: number;
  srcDocType: string | null;
  srcDocId: string | null;
  sessionId: string | null;
  decidedBy: string | null;
  usedOn: string | null;
};
const http = () => request(app.getHttpServer());
const postAs = (who: string, device: string, path: string, body: object) =>
  http().post(`/api/v1/till/${path}`).set('Authorization', as(who, device)).send(body);
const scope = { companyId: COMPANY, branchId: BRANCH };
const key = (s: Session) => ({ ...scope, accYear: s.tssAccYear, tssId: s.tssId });
const tapKey = (a: Approval) => ({ ...scope, accYear: a.tapAccYear, tapId: a.tapId });
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};

async function ask(who: string, body: Record<string, unknown>): Promise<request.Response> {
  const res = await postAs(who, tillPc, 'approvals/request', { ...scope, ...body });
  if (res.status === 200) {
    approvals.push(data<Approval>(res).tapId);
  }
  return res;
}

const openWith = (lines: object[], extra: Record<string, unknown> = {}) =>
  postAs('tester1', tillPc, 'sessions/open', {
    ...scope,
    floatMode: 'ISSUED',
    floatIssued: 500,
    lines,
    notes: 'e2e float short',
    ...extra,
  });

/** End billing, count what the drawer should hold, close: the counter is free again. */
async function closeExact(s: Session, lines: object[]) {
  expectStatus(await postAs('tester1', tillPc, 'sessions/end-billing', key(s)), 200);
  const counted = await postAs('tester1', tillPc, 'sessions/count', { ...key(s), lines });
  expect(data<{ outcome: string }>(counted).outcome).toBe('ACCEPTED');
  expectStatus(await postAs('tester1', tillPc, 'sessions/close', key(s)), 200);
}

async function openVariance(s: Session) {
  const [row] = await prisma.$queryRaw<{ tvr_id: string; approval_id: string | null }[]>`
    SELECT tvr_id::text, tvr_approval_id::text AS approval_id FROM accounts.till_variance
     WHERE tvr_session_id = ${s.tssId}::uuid AND tvr_stage = 'OPEN' AND tvr_is_deleted = false`;
  return row;
}

beforeAll(async () => {
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-gate-${tag}-${name}`}, ${`E2E ${name}`}, 'Desktop')
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

  rights.push(await grantMenuRights(prisma, TILL_MENUS, TESTER1));
  rights.push(await grantMenuRights(prisma, TILL_MENUS, PRATHAP));
  app = await bootIdentityApp();

  const safe = await postAs('tester1', officePc, 'safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2EG${tag}`,
    tsfName: 'E2E gate safe',
    tsfIsDefault: false,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`E2EG${tag}`}, 'E2E gate counter', ${tillPc}::uuid, ${safeId}::uuid, ${SETTING_TAG})
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;
  const [grant] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO accounts.till_approval_authority
      (taa_user_id, taa_company_id, taa_branch_id, taa_role, taa_event_code, taa_max_amount, taa_can_remote, taa_created_by)
    VALUES (${PRATHAP}::uuid, ${COMPANY}::uuid, NULL, 'STORE_MANAGER', NULL, NULL, false, ${SETTING_TAG})
    RETURNING taa_id::text AS id`;
  grantId = grant.id;
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${await hashSecret('2468')} WHERE usr_id = ${PRATHAP}::uuid`;
});

afterAll(async () => {
  const ids = sessions.map((s) => s.tssId);
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_approval_id = ANY(${approvals}::uuid[])`;
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
  await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_id = ANY(${approvals}::uuid[])`;
  await prisma.$executeRaw`DELETE FROM public.app_setting_value WHERE asv_created_by = ${SETTING_TAG}`;
  await prisma.$executeRaw`DELETE FROM accounts.till_approval_authority WHERE taa_id = ${grantId ?? null}::uuid`;
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

describe('request · decide · cancel · inbox', () => {
  let pending: Approval;

  it('a request is PENDING; asking again for the same document gives it back; a rule that asks nothing is 422', async () => {
    const body = {
      event: 'VOID_BILL',
      amount: 450,
      srcDocType: 'SALE_BILL',
      srcDocId: counterId,
      srcRefno: `E2E-${tag}`,
      note: 'Customer changed their mind',
    };
    const res = await ask('tester1', body);
    expectStatus(res, 200);
    pending = data<Approval>(res);
    expect(pending).toEqual(
      expect.objectContaining({ status: 'PENDING', event: 'VOID_BILL', amount: 450 }),
    );
    const again = await ask('tester1', body);
    expect(data<Approval>(again).tapId).toBe(pending.tapId);

    // PAID_IN ships NEVER: nothing to approve.
    const never = await ask('tester1', { event: 'PAID_IN', amount: 100 });
    expectStatus(never, 422);
    expect(firstError(never)).toEqual(
      expect.objectContaining({ code: 'TILL_APPROVAL_INVALID', needed: false }),
    );
  });

  it('the inbox lists it: the requester cannot decide it, the approver can', async () => {
    const mine = await http()
      .get('/api/v1/till/approvals/pending')
      .query(scope)
      .set('Authorization', as('tester1', officePc));
    expectStatus(mine, 200);
    const item = data<{ items: Record<string, unknown>[] }>(mine).items.find(
      (i) => i.tapId === pending.tapId,
    );
    expect(item).toEqual(
      expect.objectContaining({
        kind: 'REQUEST',
        action: 'approvals/decide',
        canDecide: false,
        cannotBecause: 'TILL_APPROVER_SELF',
      }),
    );
    const theirs = await http()
      .get('/api/v1/till/approvals/pending')
      .query(scope)
      .set('Authorization', as('prathap', officePc));
    expect(
      data<{ items: Record<string, unknown>[] }>(theirs).items.find((i) => i.tapId === pending.tapId),
    ).toEqual(expect.objectContaining({ canDecide: true, cannotBecause: null }));
  });

  it('the requester never decides it; the approver approves by PIN; then it is no longer PENDING', async () => {
    const self = await postAs('tester1', officePc, 'approvals/decide', {
      ...tapKey(pending),
      decision: 'APPROVE',
      note: 'mine',
    });
    expectStatus(self, 403);
    expect(firstError(self).code).toBe('TILL_APPROVER_SELF');

    const res = await postAs('prathap', officePc, 'approvals/decide', {
      ...tapKey(pending),
      decision: 'APPROVE',
      approverPin: '2468',
      note: 'Checked with the customer',
    });
    expectStatus(res, 200);
    expect(data<Approval>(res)).toEqual(
      expect.objectContaining({ status: 'APPROVED', decidedBy: PRATHAP }),
    );
    const again = await postAs('prathap', officePc, 'approvals/decide', {
      ...tapKey(pending),
      decision: 'REJECT',
      approverPin: '2468',
      note: 'twice',
    });
    expectStatus(again, 409);
    expect(firstError(again)).toEqual(
      expect.objectContaining({ code: 'TILL_APPROVAL_NOT_PENDING', status: 'APPROVED' }),
    );
  });

  it('decided at the counter in one call; a wrong PIN is refused and journalled', async () => {
    const wrong = await ask('tester1', {
      event: 'VOID_LINE',
      amount: 80,
      approverId: PRATHAP,
      approverPin: '0000',
    });
    expectStatus(wrong, 403);
    expect(firstError(wrong).code).toBe('TILL_APPROVER_PIN');
    const [fails] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_device_id = ${tillPc}::uuid AND tev_event_code = 'PIN_FAIL'`;
    expect(fails.n).toBe(1);

    const res = await ask('tester1', {
      event: 'VOID_LINE',
      amount: 80,
      approverId: PRATHAP,
      approverPin: '2468',
    });
    expectStatus(res, 200);
    expect(data<Approval>(res)).toEqual(
      expect.objectContaining({ status: 'APPROVED', decidedBy: PRATHAP, event: 'VOID_LINE' }),
    );
  });

  it('cancel by whoever asked; an expired request is swept and refused', async () => {
    const res = await ask('tester1', { event: 'VOID_BILL', amount: 10 });
    const a = data<Approval>(res);
    const cancel = await postAs('tester1', tillPc, 'approvals/cancel', {
      ...tapKey(a),
      note: 'not needed',
    });
    expectStatus(cancel, 200);
    expect(data<Approval>(cancel).status).toBe('CANCELLED');
    expectStatus(await postAs('tester1', tillPc, 'approvals/cancel', tapKey(a)), 409);

    const late = data<Approval>(await ask('tester1', { event: 'VOID_BILL', amount: 20 }));
    await prisma.$executeRaw`
      UPDATE accounts.till_approval SET tap_expires_on = now() - interval '1 minute'
       WHERE tap_id = ${late.tapId}::uuid`;
    const decide = await postAs('prathap', officePc, 'approvals/decide', {
      ...tapKey(late),
      decision: 'APPROVE',
      approverPin: '2468',
      note: 'too late',
    });
    expectStatus(decide, 409);
    expect(firstError(decide).code).toBe('TILL_APPROVAL_EXPIRED');
    const got = await http()
      .get('/api/v1/till/approvals/get')
      .query(tapKey(late))
      .set('Authorization', as('tester1', tillPc));
    expect(data<Approval>(got).status).toBe('EXPIRED');
  });
});

describe('FLOAT_MISMATCH at open', () => {
  // Built when called: note100 is read in beforeAll.
  const short = () => [{ tenderTypeId: 1, denominationId: note100, qty: 4 }];
  const counted400 = short;

  it('WARN (as shipped): the open goes through and files a request on the session; its approval lands on the variance', async () => {
    const res = await openWith(short());
    expectStatus(res, 201);
    const s = data<Session>(res);
    sessions.push(s);
    const [filed] = await prisma.$queryRaw<
      { tap_id: string; tap_acc_year: string; status: string; src: string; amount: string }[]
    >`
      SELECT tap_id::text, tap_acc_year, tap_status AS status, tap_src_doc_type AS src, tap_amount::text AS amount
        FROM accounts.till_approval
       WHERE tap_session_id = ${s.tssId}::uuid AND tap_event_code = 'FLOAT_MISMATCH'`;
    expect(filed).toEqual(
      expect.objectContaining({ status: 'PENDING', src: 'TILL_SESSION', amount: '100.00' }),
    );
    expect((await openVariance(s)).approval_id).toBeNull();

    const decided = await postAs('prathap', officePc, 'approvals/decide', {
      ...scope,
      accYear: filed.tap_acc_year,
      tapId: filed.tap_id,
      decision: 'APPROVE',
      approverPin: '2468',
      note: 'Float bag was short',
    });
    expectStatus(decided, 200);
    expect((await openVariance(s)).approval_id).toBe(filed.tap_id);
    await closeExact(s, counted400());
  });

  it('REFUSE: 428 naming the counter; a wrong approval is 422; the approved one opens and is used up', async () => {
    await prisma.$executeRaw`
      INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_device_id, asv_value, asv_created_by)
      VALUES ('till.approval_gate', 'DEVICE', ${tillPc}::uuid, 'REFUSE', ${SETTING_TAG})`;
    const refused = await openWith(short());
    expectStatus(refused, 428);
    expect(firstError(refused)).toEqual(
      expect.objectContaining({
        code: 'TILL_APPROVAL_REQUIRED',
        field: 'approvalId',
        event: 'FLOAT_MISMATCH',
        amount: 100,
        srcDocType: 'TILL_COUNTER',
        srcDocId: counterId,
      }),
    );

    const other = data<Approval>(
      await ask('tester1', {
        event: 'VOID_LINE',
        amount: 100,
        approverId: PRATHAP,
        approverPin: '2468',
      }),
    );
    const wrong = await openWith(short(), { approvalId: other.tapId });
    expectStatus(wrong, 422);
    expect(firstError(wrong).code).toBe('TILL_APPROVAL_INVALID');

    const ok = data<Approval>(
      await ask('tester1', {
        event: 'FLOAT_MISMATCH',
        amount: 100,
        srcDocType: 'TILL_COUNTER',
        srcDocId: counterId,
        approverId: PRATHAP,
        approverPin: '2468',
        note: 'Float bag short by a note',
      }),
    );
    expect(ok.status).toBe('APPROVED');
    const opened = await openWith(short(), { approvalId: ok.tapId });
    expectStatus(opened, 201);
    const s = data<Session>(opened);
    sessions.push(s);
    expect((await openVariance(s)).approval_id).toBe(ok.tapId);
    const got = await http()
      .get('/api/v1/till/approvals/get')
      .query(tapKey(ok))
      .set('Authorization', as('tester1', tillPc));
    expect(data<Approval>(got)).toEqual(
      expect.objectContaining({ sessionId: s.tssId, usedOn: expect.any(String) }),
    );
    await closeExact(s, counted400());

    // Used up: it approves no second open.
    const reused = await openWith(short(), { approvalId: ok.tapId });
    expectStatus(reused, 422);
    expect(firstError(reused).code).toBe('TILL_APPROVAL_INVALID');
    await prisma.$executeRaw`DELETE FROM public.app_setting_value WHERE asv_created_by = ${SETTING_TAG}`;
  });
});
