import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { hashSecret } from '../src/common/utils/secret-hash.utils';
import { as, bootIdentityApp, PRATHAP, TESTER } from './helpers/identity-app';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from './helpers/menu-rights';
import {
  BRANCH,
  COMPANY,
  data,
  draftBody,
  expectStatus,
  PAYMENT_MENU,
  PaymentFixtures,
  prisma,
} from './helpers/payment-e2e';
import { dropTestDay } from './helpers/till-cleanup';

/**
 * Notes 131 — the CASH_PAYMENT gate on Payment's one-call post
 * (`/payments/create` with `post: true`), against the dev database.
 *
 *   WARN (as shipped)  it posts, and a PENDING request waits in the inbox
 *   REFUSE             428 TILL_APPROVAL_REQUIRED, and the payment is KEPT as a
 *                      DRAFT the error names (srcDocType PAYMENT, srcDocId):
 *                      no leg, no session stamp; a request still PENDING is
 *                      422; once approved, the same call with that avhVoucherId
 *                      and approvalId posts the same voucher and uses the
 *                      request up; brought on a new payment it is 422 and
 *                      saves nothing
 *
 * tester is the cashier on the till PC (tester1 may hold a session elsewhere);
 * prathap the approver, with a STORE_MANAGER grant on every event. The suite
 * owns its devices, safe, counter, session, settings, prathap's PIN and grant,
 * and every voucher and request it makes.
 *
 *     npm run test:e2e -- payment-approval-gate-http --runInBand
 */

jest.setTimeout(240_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285];
const CASH_TENDER = { id: '019fbbd0-9a8e-73db-b762-175dda2e1762', type: 1 };
const SETTING_TAG = 'e2e-payment-gate';
const tag = Date.now().toString(36).toUpperCase().slice(-6);
const scope = { companyId: COMPANY, branchId: BRANCH };
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
const payments = new PaymentFixtures();
const approvals: string[] = [];
let tillPc: string;
let officePc: string;
let safeId: string;
let counterId: string;
let grantId: string;
let prathapPin: string | null = null;
let session: { tssId: string; tssAccYear: string; tssDayId: string };
let dayCreated = false;

type Approval = {
  tapId: string;
  tapAccYear: string;
  status: string;
  srcDocType: string | null;
  srcDocId: string | null;
  usedOn: string | null;
};

const http = () => request(app.getHttpServer());
const postAs = (who: string, device: string, path: string, body: object) =>
  http().post(`/api/v1/${path}`).set('Authorization', as(who, device)).send(body);
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};
const TESTER_LOGIN = 'tester';

/** A cash payment on account, saved and posted in one call by the cashier at the till. */
const payInOneCall = (partyId: string, amount: number, extra: Record<string, unknown> = {}) =>
  postAs(TESTER_LOGIN, tillPc, 'payments/create', {
    ...draftBody(
      partyId,
      [{ tdRowNo: 1, tdTenderId: CASH_TENDER.id, tdTenderTypeId: CASH_TENDER.type, tdAmount: amount }],
      { avhUserId: TESTER },
    ),
    allocations: [],
    onAccount: amount,
    post: true,
    ...extra,
  });

async function headersOf(partyId: string) {
  return prisma.$queryRaw<{ id: string; status: string; session: string | null; legs: number }[]>`
    SELECT h.avh_voucher_id::text AS id, h.avh_voucher_status AS status, h.avh_session_id::text AS session,
           (SELECT count(*)::int FROM accounts.acc_vouchers v
             WHERE v.av_voucher_id = h.avh_voucher_id AND v.av_is_deleted = false) AS legs
      FROM accounts.acc_voucher_header h
     WHERE h.avh_party_id = ${partyId}::uuid AND h.avh_is_deleted = false`;
}

async function approvalsOf(voucherId: string) {
  return prisma.$queryRaw<{ id: string; status: string; used: string | null }[]>`
    SELECT tap_id::text AS id, tap_status AS status, tap_rule_snapshot ->> 'usedDocId' AS used
      FROM accounts.till_approval
     WHERE tap_src_doc_type = 'PAYMENT' AND tap_src_doc_id = ${voucherId}::uuid AND NOT tap_is_deleted`;
}

async function postedEvents(voucherId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.till_event
     WHERE tev_event_code = 'PAYMENT_POSTED' AND tev_src_doc_id = ${voucherId}::uuid`;
  return row.n;
}

beforeAll(async () => {
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-pgate-${tag}-${name}`}, ${`E2E ${name}`}, 'Desktop')
      RETURNING dev_id::text`;
    return row.dev_id;
  };
  tillPc = await device('till');
  officePc = await device('office');
  const [day] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid AND tbd_is_deleted = false`;
  dayCreated = day.n === 0;

  rights.push(await grantMenuRights(prisma, [...TILL_MENUS, PAYMENT_MENU], TESTER));
  rights.push(await grantMenuRights(prisma, TILL_MENUS, PRATHAP));
  app = await bootIdentityApp();

  const safe = await postAs(TESTER_LOGIN, officePc, 'till/safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2EP${tag}`,
    tsfName: 'E2E payment gate safe',
    tsfIsDefault: false,
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`E2EP${tag}`}, 'E2E payment gate counter', ${tillPc}::uuid, ${safeId}::uuid, ${SETTING_TAG})
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;
  const [grant] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO accounts.till_approval_authority
      (taa_user_id, taa_company_id, taa_branch_id, taa_role, taa_event_code, taa_max_amount, taa_can_remote, taa_created_by)
    VALUES (${PRATHAP}::uuid, ${COMPANY}::uuid, NULL, 'STORE_MANAGER', NULL, NULL, false, ${SETTING_TAG})
    RETURNING taa_id::text AS id`;
  grantId = grant.id;
  const [pin] = await prisma.$queryRaw<{ hash: string | null }[]>`
    SELECT usr_pin_hash AS hash FROM public.user_master WHERE usr_id = ${PRATHAP}::uuid`;
  prathapPin = pin.hash;
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${await hashSecret('2468')} WHERE usr_id = ${PRATHAP}::uuid`;

  const open = await postAs(TESTER_LOGIN, tillPc, 'till/sessions/open', {
    ...scope,
    floatMode: 'NONE',
    lines: [],
  });
  expectStatus(open, 201);
  session = data(open);
  // The drawer opens empty and pays cash out: let it run negative (notes 122 §5).
  await prisma.$executeRaw`
    INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_device_id, asv_value, asv_created_by)
    VALUES ('till.cash_out_over_expected', 'DEVICE', ${tillPc}::uuid, 'ALLOW', ${SETTING_TAG})`;
});

afterAll(async () => {
  const vouchers = [...payments.vouchers];
  if (vouchers.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM accounts.till_event WHERE tev_approval_id IN (
        SELECT tap_id FROM accounts.till_approval WHERE tap_src_doc_id = ANY(${vouchers}::uuid[]))`;
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_src_doc_id = ANY(${vouchers}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_src_doc_id = ANY(${vouchers}::uuid[])`;
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_approval_id = ANY(${approvals}::uuid[])`;
  await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_id = ANY(${approvals}::uuid[])`;
  await payments.teardown();
  if (session) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ${session.tssId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_id = ${session.tssId}::uuid`;
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_device_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  // Never till_event by day: the day is the live branch's (notes 115).
  if (dayCreated && session) {
    await dropTestDay(prisma, session.tssDayId);
  }
  await prisma.$executeRaw`DELETE FROM public.app_setting_value WHERE asv_created_by = ${SETTING_TAG}`;
  await prisma.$executeRaw`DELETE FROM accounts.till_approval_authority WHERE taa_id = ${grantId ?? null}::uuid`;
  await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${prathapPin} WHERE usr_id = ${PRATHAP}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counterId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_id = ${safeId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id IN (${tillPc ?? null}::uuid, ${officePc ?? null}::uuid)`;
  for (const memo of rights.reverse()) {
    await restoreMenuRights(prisma, memo);
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('CASH_PAYMENT on /payments/create with post: true', () => {
  it('WARN (as shipped): it posts, and a PENDING request waits in the inbox', async () => {
    const payee = await payments.createParty(`PGW-${tag}`);
    const res = await payInOneCall(payee, 1500);
    expectStatus(res, 201);
    const voucherId = res.body.data.header.avhVoucherId as string;
    payments.vouchers.push(voucherId);
    expect(res.body.data.approval).toEqual(
      expect.objectContaining({ event: 'CASH_PAYMENT', amount: 1500, enforced: false }),
    );
    expect(await approvalsOf(voucherId)).toEqual([
      expect.objectContaining({ status: 'PENDING', used: null }),
    ]);
  });

  it('REFUSE: 428 keeps the DRAFT it names; approved, the same call posts it; the request is used up', async () => {
    await prisma.$executeRaw`
      INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_device_id, asv_value, asv_created_by)
      VALUES ('till.approval_gate', 'DEVICE', ${tillPc}::uuid, 'REFUSE', ${SETTING_TAG})`;
    const payee = await payments.createParty(`PGR-${tag}`);

    const refused = await payInOneCall(payee, 1500);
    expectStatus(refused, 428);
    const detail = firstError(refused);
    expect(detail).toEqual(
      expect.objectContaining({
        code: 'TILL_APPROVAL_REQUIRED',
        field: 'approvalId',
        event: 'CASH_PAYMENT',
        amount: 1500,
        requiredRole: 'SUPERVISOR',
        srcDocType: 'PAYMENT',
        srcDocId: expect.any(String),
      }),
    );
    const voucherId = detail.srcDocId as string;
    payments.vouchers.push(voucherId);
    // The draft survived; the post's writes did not (no leg, no PAYMENT_POSTED).
    expect(await headersOf(payee)).toEqual([
      expect.objectContaining({ id: voucherId, status: 'DRAFT', legs: 0 }),
    ]);
    expect(await postedEvents(voucherId)).toBe(0);
    expect(await approvalsOf(voucherId)).toEqual([]);

    // Sent to the inbox: still PENDING, so it unlocks nothing yet.
    const asked = await postAs(TESTER_LOGIN, tillPc, 'till/approvals/request', {
      ...scope,
      event: 'CASH_PAYMENT',
      amount: 1500,
      srcDocType: 'PAYMENT',
      srcDocId: voucherId,
      note: 'Paying the transporter in cash',
    });
    expectStatus(asked, 200);
    const tap = data<Approval>(asked);
    approvals.push(tap.tapId);
    expect(tap.status).toBe('PENDING');
    const early = await payInOneCall(payee, 1500, { avhVoucherId: voucherId, approvalId: tap.tapId });
    expectStatus(early, 422);
    expect(firstError(early).code).toBe('TILL_APPROVAL_INVALID');
    expect((await headersOf(payee)).map((h) => h.status)).toEqual(['DRAFT']);

    const decided = await postAs('prathap', officePc, 'till/approvals/decide', {
      ...scope,
      accYear: tap.tapAccYear,
      tapId: tap.tapId,
      decision: 'APPROVE',
      approverPin: '2468',
      note: 'Transporter paid in cash',
    });
    expectStatus(decided, 200);

    const posted = await payInOneCall(payee, 1500, {
      avhVoucherId: voucherId,
      approvalId: tap.tapId,
    });
    expectStatus(posted, 201);
    expect(posted.body.data.header).toEqual(
      expect.objectContaining({ avhVoucherId: voucherId, avhVoucherStatus: 'POSTED' }),
    );
    expect(posted.body.data.approval).toEqual(
      expect.objectContaining({ event: 'CASH_PAYMENT', enforced: true, approvalId: tap.tapId }),
    );
    const [header] = await headersOf(payee);
    expect(header).toEqual(
      expect.objectContaining({ id: voucherId, status: 'POSTED', session: session.tssId }),
    );
    expect(header.legs).toBeGreaterThan(0);
    expect(await postedEvents(voucherId)).toBe(1);
    expect(await approvalsOf(voucherId)).toEqual([
      expect.objectContaining({ id: tap.tapId, status: 'APPROVED', used: voucherId }),
    ]);

    // Used up, and it approves that payment only: a new one is 422 and saves nothing.
    const other = await payments.createParty(`PGO-${tag}`);
    const reused = await payInOneCall(other, 1500, { approvalId: tap.tapId });
    expectStatus(reused, 422);
    expect(firstError(reused).code).toBe('TILL_APPROVAL_INVALID');
    expect(await headersOf(other)).toEqual([]);
    await prisma.$executeRaw`
      DELETE FROM public.app_setting_value
       WHERE asv_created_by = ${SETTING_TAG} AND asv_setting_key = 'till.approval_gate'`;
  });
});
