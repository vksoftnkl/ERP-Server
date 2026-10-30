import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { hashSecret } from '../src/common/utils/secret-hash.utils';
import {
  TillDayHeaderProvider,
  TillMovementHeaderProvider,
  TillMovementLinesProvider,
  TillRemitHeaderProvider,
  TillRemitLinesProvider,
} from '../src/modules/settings/print-render/data/providers/till.providers';
import type { PrintDataProvider } from '../src/modules/settings/print-render/data/print-data-provider.types';
import { as, bootIdentityApp, PRATHAP, TESTER } from './helpers/identity-app';
import {
  grantMenuRights,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import { COMPANY, data, expectStatus, prisma } from './helpers/payment-e2e';

/**
 * Notes 118 — the safe: its balance, its count, remittance to the bank. On a
 * TEMPORARY BRANCH of the e2e company (notes 115: nothing here may touch the
 * live branch's day or safe). The safe posts to the SAFE_CASH role's ledger,
 * which no other active safe of the branch shares, and an opening balance of
 * 10,000 on it for the branch is the cash it held before the till.
 *
 *   balance   the book before any count; hidden from a viewer without OVERRIDE
 *   flows     a float issued, a hand-over in only once its cash is approved
 *   count     within tolerance posted · decided in the step (two-person: the
 *             witness) · sent for approval, decided later with a second PIN
 *   remit     over the balance refused; a bank deposit; a void; a CIT one and
 *             its confirmation short by 5; refusals once confirmed / counted since
 *   day       SAFE_NOT_COUNTED RED until counted; the day close freezes the
 *             safe figures; a closed day takes no count
 *
 * tester1 (SUPER ADMIN) is the cashier and counts; prathap a store manager
 * with a SAFE_VARIANCE grant (PIN 2468); 'tester' the witness / second (PIN
 * 1357), with no OVERRIDE on Cash Office or Till Sessions — the blind viewer.
 *
 *     npm run test:e2e -- till-safe-http --runInBand
 */

jest.setTimeout(240_000);

const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282, 285, 287];
const tag = Date.now().toString(36).toUpperCase().slice(-6);
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
let branchId: string;
let tillPc: string;
let officePc: string;
let safeId: string;
let safeLedger: string;
let counterId: string;
let bankLedger: string;
let transitLedger: string;
let openingId: string | null = null;
let accYear: string;
let note500: string;
let note100: string;
let varianceReason: string;
let voidReason: string;
const grants: string[] = [];
const pins: Record<string, string | null> = {};

type Session = { tssId: string; tssAccYear: string; tssDayId: string };
type Line = { tenderTypeId: number; denominationId?: string; qty?: number; enteredAmount?: number };
type Safe = {
  expected: number | null;
  opening: number | null;
  openingFrom: string;
  bookBalance: number | null;
  drift: number | null;
  overInsured: boolean;
  ledgerShared: boolean;
  countedToday: boolean;
  pendingGaps: { tvrId: string; tvrAccYear: string }[];
  out: { floatIssues: number; remittances: number } | null;
};
const http = () => request(app.getHttpServer());
const postAs = (who: string, device: string, path: string, body: object) =>
  http().post(`/api/v1/till/${path}`).set('Authorization', as(who, device)).send(body);
const getAs = (who: string, device: string, path: string, query: object) =>
  http().get(`/api/v1/till/${path}`).set('Authorization', as(who, device)).query(query);
const scope = () => ({ companyId: COMPANY, branchId });
const key = (s: Session) => ({ ...scope(), accYear: s.tssAccYear, tssId: s.tssId });
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};
const notes = (n500: number, n100 = 0, loose = 0): Line[] => [
  ...(n500 ? [{ tenderTypeId: 1, denominationId: note500, qty: n500 }] : []),
  ...(n100 ? [{ tenderTypeId: 1, denominationId: note100, qty: n100 }] : []),
  ...(loose ? [{ tenderTypeId: 1, enteredAmount: loose }] : []),
];

async function safe(
  who = 'tester1',
): Promise<Safe & { figuresVisible: boolean; inTransit: { tcmId: string }[] }> {
  const res = await getAs(who, officePc, 'safes/balance', { ...scope(), safeId });
  expectStatus(res, 200);
  const body = data<{ figuresVisible: boolean; safes: Safe[]; inTransit: { tcmId: string }[] }>(
    res,
  );
  return { ...body.safes[0], figuresVisible: body.figuresVisible, inTransit: body.inTransit };
}

async function closeCheck(dayId: string) {
  const res = await getAs('tester1', officePc, 'days/close-check', {
    ...scope(),
    accYear,
    tbdId: dayId,
  });
  expectStatus(res, 200);
  return data<{
    items: { code: string; tone: string; count: number }[];
    canClose: boolean;
    canCloseWithException: boolean;
  }>(res);
}
const toneOf = (items: { code: string; tone: string }[], code: string) =>
  items.find((i) => i.code === code)?.tone;

/** A till print provider's rows for one movement, as the render hands them to a layout (notes 135). */
async function printed<T>(
  provider: new (...args: never[]) => PrintDataProvider,
  doc: { tcmId: string; tcmAccYear: string },
  userId = TESTER1,
): Promise<T> {
  return (await app.get(provider).resolve({
    context: {
      companyId: COMPANY,
      branchId,
      accYear: doc.tcmAccYear,
      docId: doc.tcmId,
      userId,
      deviceId: officePc,
    },
    params: {},
    lang: 'en',
    rowLimit: 100,
  })) as T;
}

/** user_master's name as a print shows it: the display name, else the login. */
async function nameOf(userId: string): Promise<string> {
  const [u] = await prisma.$queryRaw<{ n: string }[]>`
    SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS n
      FROM public.user_master WHERE usr_id = ${userId}::uuid`;
  return u.n;
}

async function legs(voucherId: string) {
  return prisma.$queryRaw<{ ledger: string; dr_cr: string; amount: string }[]>`
    SELECT av_ledger_id::text AS ledger, av_dr_cr AS dr_cr, av_amount::text AS amount
      FROM accounts.acc_vouchers WHERE av_voucher_id = ${voucherId}::uuid ORDER BY av_dr_cr DESC`;
}

beforeAll(async () => {
  const [branch] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO public.branch_master (br_comp_id, br_name, br_state_code, br_is_default)
    SELECT ${COMPANY}::uuid, ${`E2E safe ${tag}`}, br_state_code, false
      FROM public.branch_master WHERE br_comp_id = ${COMPANY}::uuid AND br_is_deleted = false
     ORDER BY br_is_default DESC LIMIT 1
    RETURNING br_id::text AS id`;
  branchId = branch.id;
  const device = async (name: string) => {
    const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
      INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
      VALUES (${COMPANY}::uuid, ${branchId}::uuid, ${`e2e-safe-${tag}-${name}`}, ${`E2E ${name}`}, 'Desktop')
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
  const reason = async (category: string) => {
    const [r] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT trs_id::text AS id FROM accounts.till_reason
       WHERE trs_company_id IS NULL AND NOT trs_is_deleted AND trs_is_active
         AND trs_category = ${category} AND NOT trs_needs_note
       ORDER BY trs_sort_order LIMIT 1`;
    return r.id;
  };
  varianceReason = await reason('VARIANCE');
  voidReason = await reason('MOVEMENT_VOID');
  const [bank] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT led_id::text AS id FROM accounts.acc_ledger_master
     WHERE (led_company_id = ${COMPANY}::uuid OR led_company_id IS NULL)
       AND NOT led_is_deleted AND led_is_active
       AND led_group_id = '019eee86-f34b-7e27-8aee-2b5930314c8a'::uuid
     ORDER BY led_name LIMIT 1`;
  bankLedger = bank.id;
  const role = async (code: string) => {
    const [r] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT alm_ledger_id::text AS id FROM accounts.acc_ledger_map
       WHERE alm_role = ${code} AND alm_company_id IS NULL AND alm_branch_id IS NULL`;
    return r.id;
  };
  safeLedger = await role('SAFE_CASH');
  transitLedger = await role('CASH_IN_TRANSIT');

  for (const user of [TESTER1, PRATHAP, TESTER]) {
    rights.push(await grantMenuRights(prisma, TILL_MENUS, user));
  }
  // the blind viewer: Cash Office VIEW + CREATE, no OVERRIDE anywhere
  await prisma.$executeRaw`
    UPDATE public.user_menus SET um_can_override = false
     WHERE um_user_id = ${TESTER}::uuid AND um_menu_id IN (273, 287) AND um_is_deleted = false`;
  for (const [user, pin] of [
    [PRATHAP, '2468'],
    [TESTER, '1357'],
  ] as const) {
    const [row] = await prisma.$queryRaw<{ h: string | null }[]>`
      SELECT usr_pin_hash AS h FROM public.user_master WHERE usr_id = ${user}::uuid`;
    pins[user] = row?.h ?? null;
    await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${await hashSecret(pin)} WHERE usr_id = ${user}::uuid`;
  }
  const [g] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO accounts.till_approval_authority
      (taa_user_id, taa_company_id, taa_branch_id, taa_role, taa_event_code, taa_max_amount, taa_can_remote, taa_created_by)
    VALUES (${PRATHAP}::uuid, ${COMPANY}::uuid, ${branchId}::uuid, 'STORE_MANAGER', 'SAFE_VARIANCE', NULL, false, 'e2e-safe')
    RETURNING taa_id::text AS id`;
  grants.push(g.id);

  app = await bootIdentityApp();
  const created = await postAs('tester1', officePc, 'safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: branchId,
    tsfCode: `E2ES${tag}`,
    tsfName: 'E2E safe',
    tsfIsDefault: true,
    tsfIsDropSafe: true,
    tsfInsuredLimit: 5000,
  });
  expectStatus(created, 201);
  safeId = created.body.data.tsfId;
  expect(created.body.data.tsfLedgerId).toBe(safeLedger);
  const [counter] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_safe_id, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${branchId}::uuid, ${`E2ES${tag}`}, 'E2E safe counter', ${tillPc}::uuid, ${safeId}::uuid, 'e2e-safe')
    RETURNING tcn_id::text`;
  counterId = counter.tcn_id;

  const [y] = await prisma.$queryRaw<{ y: string }[]>`
    SELECT CASE WHEN extract(month FROM now() - interval '4 hours') >= 4
                THEN extract(year FROM now() - interval '4 hours')::int || '-' || (extract(year FROM now() - interval '4 hours')::int + 1)
                ELSE (extract(year FROM now() - interval '4 hours')::int - 1) || '-' || extract(year FROM now() - interval '4 hours')::int
           END AS y`;
  accYear = y.y;
  const [ob] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO accounts.acc_opening_balance
      (op_company_id, op_branch_id, op_acc_year, op_ledger_id, op_amount, op_dr_cr, op_source, op_created_by)
    VALUES (${COMPANY}::uuid, ${branchId}::uuid, ${accYear}, ${safeLedger}::uuid, 10000, 'D', 'MANUAL', 'e2e-safe')
    RETURNING op_id::text AS id`;
  openingId = ob.id;
});

afterAll(async () => {
  // Everything of the temporary branch is this suite's own (notes 115).
  if (branchId) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_approval WHERE tap_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM accounts.till_count_line WHERE tcl_count_id IN (
        SELECT tct_id FROM accounts.till_count WHERE tct_branch_id = ${branchId}::uuid)`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_branch_id = ${branchId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_branch_id = ${branchId}::uuid`;
    // notes 126: the till's transfers carry the server's tender rows (td_src_doc_type 'VOUCHER'),
    // which name the branch — the temporary branch is not deleted while they stand
    await prisma.$executeRaw`DELETE FROM accounts.acc_tender_detail WHERE td_branch_id = ${branchId}::uuid`;
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
    if (openingId) {
      await prisma.$executeRaw`DELETE FROM accounts.acc_opening_balance WHERE op_id = ${openingId}::uuid AND op_acc_year = ${accYear}`;
    }
  }
  for (const id of grants) {
    await prisma.$executeRaw`DELETE FROM accounts.till_approval_authority WHERE taa_id = ${id}::uuid`;
  }
  for (const [user, hash] of Object.entries(pins)) {
    await prisma.$executeRaw`UPDATE public.user_master SET usr_pin_hash = ${hash} WHERE usr_id = ${user}::uuid`;
  }
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

describe('notes 118 · the safe', () => {
  let s: Session;
  let businessDate: string;
  let deposit: { tcmId: string; tcmAccYear: string; tcmVoucherId: string };
  let cit: { tcmId: string; tcmAccYear: string };

  it('§1 before any count the safe expects what its ledger holds; a viewer without OVERRIDE sees no figure', async () => {
    const before = await safe();
    expect(before).toEqual(
      expect.objectContaining({
        figuresVisible: true,
        openingFrom: 'BOOK',
        ledgerShared: false,
        expected: 10000,
        bookBalance: 10000,
        drift: 0,
        overInsured: true,
      }),
    );
    const blind = await safe('tester');
    expect(blind).toEqual(
      expect.objectContaining({
        figuresVisible: false,
        expected: null,
        opening: null,
        drift: null,
        out: null,
      }),
    );
  });

  it('§1 a float issued leaves the safe; the hand-over enters only once its cash is approved', async () => {
    const open = await postAs('tester1', tillPc, 'sessions/open', {
      ...scope(),
      floatMode: 'ISSUED',
      floatIssued: 500,
      lines: notes(1),
    });
    expectStatus(open, 201);
    s = data<Session>(open);
    expect((await safe()).expected).toBe(9500);

    const check = await closeCheck(s.tssDayId);
    expect(toneOf(check.items, 'SAFE_NOT_COUNTED')).toBe('RED');
    expect(check.canCloseWithException).toBe(true);

    expectStatus(await postAs('tester1', tillPc, 'sessions/end-billing', key(s)), 200);
    const count = await postAs('tester1', tillPc, 'sessions/count', { ...key(s), lines: notes(1) });
    expect(data<{ outcome: string }>(count).outcome).toBe('ACCEPTED');
    expectStatus(
      await postAs('tester1', tillPc, 'sessions/close', { ...key(s), floatLeft: 0 }),
      200,
    );
    // the company runs till.handover_receipt REQUIRED: the hand-over waits
    expect((await safe()).expected).toBe(9500);
    const approved = await postAs('prathap', officePc, 'sessions/approve-cash', {
      ...key(s),
      approverPin: '2468',
    });
    expectStatus(approved, 200);
    const now = await safe();
    expect(now).toEqual(expect.objectContaining({ expected: 10000, bookBalance: 10000, drift: 0 }));
    expect(now.out?.floatIssues).toBe(500);
  });

  it('notes 135 · the float’s and the hand-over’s slips: names, the count, the purpose', async () => {
    const moved = await prisma.$queryRaw<{ tcmId: string; tcmAccYear: string; kind: string }[]>`
      SELECT tcm_id::text AS "tcmId", tcm_acc_year AS "tcmAccYear", tcm_kind AS kind
        FROM accounts.till_cash_movement
       WHERE tcm_session_id = ${s.tssId}::uuid AND tcm_acc_year = ${s.tssAccYear}::char(9)`;
    const float = moved.find((m) => m.kind === 'FLOAT_ISSUE')!;
    const handover = moved.find((m) => m.kind === 'CLOSE_HANDOVER')!;
    const cashier = await nameOf(TESTER1);

    const f = await printed<Record<string, unknown>>(TillMovementHeaderProvider, float);
    expect(f).toEqual(
      expect.objectContaining({
        kind: 'FLOAT_ISSUE',
        kind_text: 'Float issue',
        status: 'POSTED',
        amount: 500,
        cashier,
        receives: cashier,
        voucher_no: expect.stringMatching(/\S/),
        print_count: 0,
      }),
    );
    expect(f.doc_date).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(f.created_on).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2} [AP]M$/);
    // the float's count is the session's OPEN count, one ₹500
    expect(await printed(TillMovementLinesProvider, float)).toEqual([
      { face_value: 500, denomination: '₹500', qty: 1, amount: 500, side: null },
    ]);

    const h = await printed<Record<string, unknown>>(TillMovementHeaderProvider, handover);
    expect(h).toEqual(
      expect.objectContaining({
        kind_text: 'Hand-over',
        gives: cashier,
        receives: await nameOf(PRATHAP),
        receipt_status: 'RECEIVED',
        received_by: await nameOf(PRATHAP),
        received_amount: 500,
      }),
    );
    expect(await printed(TillMovementLinesProvider, handover)).toEqual([
      { face_value: 500, denomination: '₹500', qty: 1, amount: 500, side: null },
    ]);

    // a movement prints only as its slip: the memo refuses it
    await expect(printed(TillRemitHeaderProvider, float)).rejects.toThrow(/TILL_MOVEMENT/);
  });

  it('§2 a blind count within tolerance posts at once; the day knows the safe was counted', async () => {
    const res = await postAs('tester1', officePc, 'safes/count', {
      ...scope(),
      safeId,
      lines: notes(19, 4, 90),
    });
    expectStatus(res, 200);
    const got = data<{
      outcome: string;
      counted: number;
      expected: number;
      difference: number;
      varianceVoucherId: string;
      businessDate: string;
      tbdId: string;
    }>(res);
    expect(got).toEqual(
      expect.objectContaining({
        outcome: 'WITHIN_TOLERANCE',
        counted: 9990,
        expected: 10000,
        difference: -10,
      }),
    );
    businessDate = got.businessDate;
    expect(got.tbdId).toBe(s.tssDayId);
    expect(await legs(got.varianceVoucherId)).toEqual([
      expect.objectContaining({ dr_cr: 'DR', amount: '10.00' }),
      expect.objectContaining({ ledger: safeLedger, dr_cr: 'CR', amount: '10.00' }),
    ]);
    expect(await safe()).toEqual(
      expect.objectContaining({
        openingFrom: 'COUNT',
        expected: 9990,
        bookBalance: 9990,
        drift: 0,
        countedToday: true,
      }),
    );
    const day = await getAs('tester1', officePc, 'days/get', {
      ...scope(),
      accYear,
      tbdId: s.tssDayId,
    });
    expect(data<{ safe: object }>(day).safe).toEqual(
      expect.objectContaining({ counted: 9990, expected: 10000, remitted: 0 }),
    );
    expect(toneOf((await closeCheck(s.tssDayId)).items, 'SAFE_NOT_COUNTED')).toBe('GREEN');
    const [ev] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_branch_id = ${branchId}::uuid AND tev_event_code = 'SAFE_COUNT'`;
    expect(ev.n).toBe(1);
  });

  it('§2 a gap beyond tolerance is decided in the step: the counter’s grant, the witness as the second signature', async () => {
    const body = {
      ...scope(),
      safeId,
      lines: notes(19, 3, 90), // 9890: 100 short
      treatment: 'EXPENSE',
      reasonId: varianceReason,
      approverPin: '2468',
    };
    const alone = await postAs('prathap', officePc, 'safes/count', body);
    expectStatus(alone, 403);
    expect(firstError(alone).code).toBe('TILL_APPROVER_SECOND');
    const wrong = await postAs('prathap', officePc, 'safes/count', {
      ...body,
      witnessId: TESTER,
      witnessPin: '0000',
    });
    expectStatus(wrong, 403);
    expect(firstError(wrong).code).toBe('TILL_WITNESS_PIN');
    const [counts] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_count WHERE tct_branch_id = ${branchId}::uuid AND tct_kind = 'SAFE'`;
    expect(counts.n).toBe(1);

    const res = await postAs('prathap', officePc, 'safes/count', {
      ...body,
      witnessId: TESTER,
      witnessPin: '1357',
    });
    expectStatus(res, 200);
    const got = data<{
      outcome: string;
      difference: number;
      tapId: string;
      treatment: string;
      tvrId: string;
    }>(res);
    expect(got).toEqual(
      expect.objectContaining({ outcome: 'DECIDED', difference: -100, treatment: 'EXPENSE' }),
    );
    const [tap] = await prisma.$queryRaw<
      { event: string; two: boolean; self: boolean; req: string; dec: string; second: string }[]
    >`
      SELECT tap_event_code AS event, tap_two_person AS two, tap_self_allowed AS self,
             tap_requested_by::text AS req, tap_decided_by::text AS dec, tap_second_by::text AS second
        FROM accounts.till_approval WHERE tap_id = ${got.tapId}::uuid`;
    expect(tap).toEqual({
      event: 'SAFE_VARIANCE',
      two: true,
      self: true,
      req: PRATHAP,
      dec: PRATHAP,
      second: TESTER,
    });
    const [tvr] = await prisma.$queryRaw<
      { stage: string; status: string; session: string | null }[]
    >`
      SELECT tvr_stage AS stage, tvr_status AS status, tvr_session_id::text AS session
        FROM accounts.till_variance WHERE tvr_id = ${got.tvrId}::uuid`;
    expect(tvr).toEqual({ stage: 'SAFE', status: 'POSTED', session: null });
    expect(await safe()).toEqual(
      expect.objectContaining({ expected: 9890, bookBalance: 9890, drift: 0 }),
    );
  });

  it('§2 a gap left undecided is pending, blocks the day, and is decided later with a second PIN', async () => {
    const res = await postAs('tester1', officePc, 'safes/count', {
      ...scope(),
      safeId,
      lines: notes(19, 4, 40),
    });
    expectStatus(res, 200);
    const got = data<{ outcome: string; difference: number; tvrId: string }>(res);
    expect(got).toEqual(expect.objectContaining({ outcome: 'SENT_FOR_APPROVAL', difference: 50 }));
    const pending = await safe();
    expect(pending).toEqual(
      expect.objectContaining({ expected: 9940, bookBalance: 9890, drift: -50 }),
    );
    expect(pending.pendingGaps).toHaveLength(1);
    const check = await closeCheck(s.tssDayId);
    expect(check.items.find((i) => i.code === 'VARIANCE_UNDECIDED')).toEqual(
      expect.objectContaining({ tone: 'RED', count: 1 }),
    );

    const body = {
      ...scope(),
      accYear: pending.pendingGaps[0].tvrAccYear,
      tvrId: got.tvrId,
      treatment: 'SUSPENSE',
      reasonId: varianceReason,
      approverPin: '2468',
    };
    const viewer = await postAs('tester', officePc, 'safes/decide-variance', body);
    expectStatus(viewer, 403);
    const alone = await postAs('prathap', officePc, 'safes/decide-variance', body);
    expectStatus(alone, 403);
    expect(firstError(alone).code).toBe('TILL_APPROVER_SECOND');
    const ok = await postAs('prathap', officePc, 'safes/decide-variance', {
      ...body,
      secondId: TESTER,
      secondPin: '1357',
    });
    expectStatus(ok, 200);
    expect(data<{ treatment: string; secondBy: string }>(ok)).toEqual(
      expect.objectContaining({ treatment: 'SUSPENSE', secondBy: TESTER }),
    );
    const [tap] = await prisma.$queryRaw<{ req: string; dec: string }[]>`
      SELECT tap_requested_by::text AS req, tap_decided_by::text AS dec FROM accounts.till_approval
       WHERE tap_id = (SELECT tvr_approval_id FROM accounts.till_variance WHERE tvr_id = ${got.tvrId}::uuid)`;
    expect(tap).toEqual({ req: TESTER1, dec: PRATHAP });
    const again = await postAs('prathap', officePc, 'safes/decide-variance', {
      ...body,
      secondId: TESTER,
      secondPin: '1357',
    });
    expectStatus(again, 409);
    expect(firstError(again).code).toBe('TILL_VARIANCE_NOT_PENDING');
    expect(await safe()).toEqual(
      expect.objectContaining({ expected: 9940, bookBalance: 9940, drift: 0 }),
    );
    expect(toneOf((await closeCheck(s.tssDayId)).items, 'VARIANCE_UNDECIDED')).toBe('GREEN');
  });

  it('§3 a bank deposit: never above the balance, never into a non-bank ledger; voided until the safe is counted', async () => {
    const base = {
      ...scope(),
      safeId,
      mode: 'BANK_DEPOSIT',
      bankLedgerId: bankLedger,
      slipNo: `SLIP${tag}`,
    };
    const over = await postAs('tester1', officePc, 'movements/remit', { ...base, amount: 99999 });
    expectStatus(over, 422);
    expect(firstError(over).code).toBe('TILL_REMIT_OVER_BALANCE');
    const notBank = await postAs('tester1', officePc, 'movements/remit', {
      ...base,
      amount: 100,
      bankLedgerId: safeLedger,
    });
    expectStatus(notBank, 422);
    expect(firstError(notBank)).toEqual(
      expect.objectContaining({ code: 'TILL_MOVEMENT_INVALID', field: 'bankLedgerId' }),
    );

    const res = await postAs('tester1', officePc, 'movements/remit', { ...base, amount: 2000 });
    expectStatus(res, 200);
    const m = data<{
      movement: {
        tcmId: string;
        tcmAccYear: string;
        tcmVoucherId: string;
        tcmRemitStatus: string;
        tcmSessionId: string | null;
      };
    }>(res).movement;
    expect(m).toEqual(expect.objectContaining({ tcmRemitStatus: 'DEPOSITED', tcmSessionId: null }));
    deposit = m;
    expect(await legs(m.tcmVoucherId)).toEqual([
      expect.objectContaining({ ledger: bankLedger, dr_cr: 'DR', amount: '2000.00' }),
      expect.objectContaining({ ledger: safeLedger, dr_cr: 'CR', amount: '2000.00' }),
    ]);
    expect((await safe()).expected).toBe(7940);

    const small = await postAs('tester1', officePc, 'movements/remit', { ...base, amount: 100 });
    expectStatus(small, 200);
    const sm = data<{ movement: { tcmId: string; tcmAccYear: string } }>(small).movement;
    expect((await safe()).expected).toBe(7840);
    const voidBody = { ...scope(), accYear: sm.tcmAccYear, tcmId: sm.tcmId, reasonId: voidReason };
    const notOverride = await postAs('tester', officePc, 'movements/void', voidBody);
    expectStatus(notOverride, 403);
    const voided = await postAs('prathap', officePc, 'movements/void', voidBody);
    expectStatus(voided, 200);
    expect(data<{ tcmStatus: string }>(voided).tcmStatus).toBe('VOIDED');
    expect(await safe()).toEqual(
      expect.objectContaining({ expected: 7940, bookBalance: 7940, drift: 0 }),
    );
    const day = await getAs('tester1', officePc, 'days/get', {
      ...scope(),
      accYear,
      tbdId: s.tssDayId,
    });
    expect(data<{ safe: { remitted: number } }>(day).safe.remitted).toBe(2000);
  });

  it('§3 a CIT remittance is in transit until the bank confirms it; a short credit is a gap on Cash in transit', async () => {
    const base = {
      ...scope(),
      safeId,
      mode: 'CIT',
      amount: 3000,
      bankLedgerId: bankLedger,
      bagNo: `BAG${tag}`,
      sealNo: `SEAL${tag}`,
      citAgency: 'E2E Secure Logistics',
    };
    const badCount = await postAs('tester1', officePc, 'movements/remit', {
      ...base,
      lines: notes(5),
    });
    expectStatus(badCount, 422);
    expect(firstError(badCount).code).toBe('TILL_COUNT_INVALID');
    const res = await postAs('tester1', officePc, 'movements/remit', { ...base, lines: notes(6) });
    expectStatus(res, 200);
    const got = data<{
      movement: {
        tcmId: string;
        tcmAccYear: string;
        tcmVoucherId: string;
        tcmRemitStatus: string;
        tcmRemitMode: string;
      };
      countId: string;
    }>(res);
    expect(got.movement).toEqual(
      expect.objectContaining({ tcmRemitStatus: 'IN_TRANSIT', tcmRemitMode: 'CIT' }),
    );
    expect(got.countId).toBeTruthy();
    cit = got.movement;
    expect(await legs(got.movement.tcmVoucherId)).toEqual([
      expect.objectContaining({ ledger: transitLedger, dr_cr: 'DR', amount: '3000.00' }),
      expect.objectContaining({ ledger: safeLedger, dr_cr: 'CR', amount: '3000.00' }),
    ]);
    const now = await safe();
    expect(now).toEqual(expect.objectContaining({ expected: 4940, overInsured: false }));
    expect(now.inTransit.map((x) => x.tcmId)).toContain(cit.tcmId);

    const confirm = { ...scope(), accYear: cit.tcmAccYear, tcmId: cit.tcmId, bankRef: `UTR${tag}` };
    const early = await postAs('tester1', officePc, 'movements/remit-confirm', {
      ...confirm,
      bankDate: '2000-01-01',
    });
    expectStatus(early, 422);
    expect(firstError(early).field).toBe('bankDate');
    const ok = await postAs('tester1', officePc, 'movements/remit-confirm', {
      ...confirm,
      bankDate: businessDate,
      bankAmount: 2995,
    });
    expectStatus(ok, 200);
    const c = data<{
      outcome: string;
      difference: number;
      confirmVoucherId: string;
      varianceVoucherId: string;
      movement: { tcmRemitStatus: string };
    }>(ok);
    expect(c).toEqual(expect.objectContaining({ outcome: 'WITHIN_TOLERANCE', difference: -5 }));
    expect(c.movement.tcmRemitStatus).toBe('CONFIRMED');
    expect(await legs(c.confirmVoucherId)).toEqual([
      expect.objectContaining({ ledger: bankLedger, dr_cr: 'DR', amount: '2995.00' }),
      expect.objectContaining({ ledger: transitLedger, dr_cr: 'CR', amount: '2995.00' }),
    ]);
    expect(await legs(c.varianceVoucherId)).toEqual([
      expect.objectContaining({ dr_cr: 'DR', amount: '5.00' }),
      expect.objectContaining({ ledger: transitLedger, dr_cr: 'CR', amount: '5.00' }),
    ]);
    const [transit] = await prisma.$queryRaw<{ bal: string }[]>`
      SELECT COALESCE(sum(av_signed_amount), 0)::text AS bal FROM accounts.acc_vouchers
       WHERE av_branch_id = ${branchId}::uuid AND av_ledger_id = ${transitLedger}::uuid`;
    expect(Number(transit.bal)).toBe(0);

    const twice = await postAs('tester1', officePc, 'movements/remit-confirm', {
      ...confirm,
      bankDate: businessDate,
    });
    expectStatus(twice, 409);
    expect(firstError(twice).code).toBe('TILL_REMIT_NOT_IN_TRANSIT');
    const voidConfirmed = await postAs('prathap', officePc, 'movements/void', {
      ...scope(),
      accYear: cit.tcmAccYear,
      tcmId: cit.tcmId,
      reasonId: voidReason,
    });
    expectStatus(voidConfirmed, 409);
    expect(firstError(voidConfirmed).code).toBe('TILL_MOVEMENT_NOT_VOIDABLE');
    expect((await safe()).inTransit).toHaveLength(0);
  });

  it('notes 135 · the remittance memos: a confirmed CIT one with the bank’s figures, a bank deposit', async () => {
    const memo = await printed<Record<string, unknown>>(TillRemitHeaderProvider, cit, TESTER);
    expect(memo).toEqual(
      expect.objectContaining({
        mode: 'CIT',
        mode_text: 'Handed to the cash collection agency',
        status: 'CONFIRMED',
        amount: 3000,
        bag_no: `BAG${tag}`,
        seal_no: `SEAL${tag}`,
        cit_agency: 'E2E Secure Logistics',
        bank_account_no: null,
        bank_amount: 2995,
        difference: -5,
        bank_ref: `UTR${tag}`,
        done_by: await nameOf(TESTER1),
        confirmed_by: await nameOf(TESTER1),
        voucher_no: expect.stringMatching(/\S/),
        confirm_voucher_no: expect.stringMatching(/\S/),
      }),
    );
    expect(memo.bank_name).toBeTruthy();
    expect(await printed(TillRemitLinesProvider, cit, TESTER)).toEqual([
      { face_value: 500, denomination: '₹500', qty: 6, amount: 3000 },
    ]);

    const slip = await printed<Record<string, unknown>>(TillRemitHeaderProvider, deposit);
    expect(slip).toEqual(
      expect.objectContaining({
        mode: 'BANK_DEPOSIT',
        mode_text: 'Deposited at the bank',
        status: 'DEPOSITED',
        amount: 2000,
        slip_no: `SLIP${tag}`,
        bank_amount: null,
        difference: null,
        confirmed_by: null,
      }),
    );
    expect(await printed(TillRemitLinesProvider, deposit)).toEqual([]);
    // a remittance prints only as its memo
    await expect(printed(TillMovementHeaderProvider, cit)).rejects.toThrow(/TILL_REMIT/);
  });

  it('§3 a remittance the safe has been counted since is not voided', async () => {
    const count = await postAs('tester1', officePc, 'safes/count', {
      ...scope(),
      safeId,
      lines: notes(9, 4, 40),
    });
    expect(data<{ outcome: string; expected: number }>(count)).toEqual(
      expect.objectContaining({ outcome: 'EXACT', expected: 4940 }),
    );
    const res = await postAs('prathap', officePc, 'movements/void', {
      ...scope(),
      accYear: deposit.tcmAccYear,
      tcmId: deposit.tcmId,
      reasonId: voidReason,
    });
    expectStatus(res, 409);
    expect(firstError(res).code).toBe('TILL_MOVEMENT_NOT_VOIDABLE');
    const got = await getAs('tester', officePc, 'movements/get', {
      ...scope(),
      accYear: deposit.tcmAccYear,
      tcmId: deposit.tcmId,
    });
    expectStatus(got, 200);
  });

  it('day close freezes the safe figures; a closed day takes no count', async () => {
    const check = await closeCheck(s.tssDayId);
    expect(check.canClose).toBe(true);
    const closed = await postAs('tester1', officePc, 'days/close', {
      ...scope(),
      accYear,
      tbdId: s.tssDayId,
    });
    expectStatus(closed, 200);
    const [day] = await prisma.$queryRaw<
      { opening: string; expected: string; counted: string; remitted: string }[]
    >`
      SELECT tbd_safe_opening::text AS opening, tbd_safe_expected::text AS expected,
             tbd_safe_counted::text AS counted, tbd_remitted::text AS remitted
        FROM accounts.till_business_day WHERE tbd_id = ${s.tssDayId}::uuid`;
    expect(day).toEqual({
      opening: '10000.00',
      expected: '4940.00',
      counted: '4940.00',
      remitted: '5000.00',
    });
    // Notes 121 §4: the day Z's safe block
    const z = (await app.get(TillDayHeaderProvider).resolve({
      context: { companyId: COMPANY, branchId, accYear, docId: s.tssDayId, userId: TESTER1, deviceId: officePc },
      params: {},
      lang: 'en',
      rowLimit: 100,
    })) as Record<string, unknown>;
    expect(z).toEqual(
      expect.objectContaining({
        safe_opening: 10000,
        safe_expected: 4940,
        safe_counted: 4940,
        safe_difference: 0,
        safe_remitted: 5000,
        safe_in_transit: 0,
      }),
    );
    const late = await postAs('tester1', officePc, 'safes/count', {
      ...scope(),
      safeId,
      lines: notes(9, 4, 40),
    });
    expectStatus(late, 409);
    expect(firstError(late).code).toBe('TILL_DAY_CLOSED');
  });
});
