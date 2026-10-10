import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { BEARER, BRANCH, COMPANY, bootApp, prisma } from './helpers/payment-e2e';
import { grantMenuRights, restoreMenuRights, TESTER1, type MenuRightsMemo } from './helpers/menu-rights';

/**
 * Till build phase 2 — the drawer movements (§5, S3), their vouchers, voids and
 * the cash limits (§8 S2), over HTTP against the dev database.
 *
 * Two people, two app instances: tester1 is the CASHIER (Open Till rights,
 * Till Sessions OVERRIDE off) on the suite's own registered device; `tester`
 * is the SUPERVISOR (Till Sessions OVERRIDE) who takes the pickup, brings the
 * change and voids. At the end the session closes and its till-cash legs —
 * originals, the void's mirror and the hand-over — net to the float left (§5.7).
 *
 * Run with --runInBand.
 */

const SUPERVISOR = '019e44fb-5d08-7b17-ad05-9e519f179708'; // user 'tester'
/** A second cashier, on a second counter, who receives change (REV 2 §2.14). */
const CASHIER2 = '019e43d9-ac09-7676-aaeb-7fac92edb6a5'; // user 'prathap'
const TILL_MENUS = [271, 272, 273, 274, 275, 276, 280, 281, 282];
const stamp = () => Date.now().toString(36).toUpperCase().slice(-6);

let cashierApp: INestApplication;
let supervisorApp: INestApplication;
let cashier2App: INestApplication;
let cashierRights: MenuRightsMemo;
let supervisorRights: MenuRightsMemo;
let cashier2Rights: MenuRightsMemo;
let deviceId: string;
let device2Id: string;
let safeId: string;
let counterId: string;
let counter2Id: string;
let session2: { tssId: string; tssAccYear: string; tssSessionNo: string };
let tillCashLedger: string;
let incomeLedger: string;
const denom: Record<string, string> = {};
const reason: Record<string, string> = {};
let session: { tssId: string; tssAccYear: string; tssSessionNo: string; tssDayId: string };
let dayCreated = false;
const ids: Record<string, string> = {};

const as = (app: INestApplication) => ({
  post: (path: string, body: object) =>
    request(app.getHttpServer()).post(`/api/v1/till/${path}`).set('Authorization', BEARER).send(body),
  get: (path: string, query: object) =>
    request(app.getHttpServer()).get(`/api/v1/till/${path}`).set('Authorization', BEARER).query(query),
});
const cashier = () => as(cashierApp);
const supervisor = () => as(supervisorApp);
const cashier2 = () => as(cashier2App);

function expectStatus(res: request.Response, status: number): void {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}
const key = () => ({ companyId: COMPANY, branchId: BRANCH, accYear: session.tssAccYear, tssId: session.tssId });
const move = (body: object) => ({ ...key(), ...body });

async function cashLimit() {
  const res = await cashier().get('sessions/get', key());
  expectStatus(res, 200);
  return res.body.data.cashLimit as { state: string; gauge: number | null };
}

/** The till cash ledger over the session's vouchers, POSTED and CANCELLED (an original and its mirror net out). */
async function tillCashNet(): Promise<number> {
  const [row] = await prisma.$queryRaw<{ net: string }[]>`
    SELECT COALESCE(sum(CASE WHEN av.av_dr_cr = 'DR' THEN av.av_amount ELSE -av.av_amount END), 0)::text AS net
      FROM accounts.acc_vouchers av
      JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = av.av_voucher_id AND h.avh_acc_year = av.av_acc_year
     WHERE h.avh_session_id = ${session.tssId}::uuid
       AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
       AND av.av_is_deleted = false
       AND av.av_ledger_id = ${tillCashLedger}::uuid`;
  return Number(row.net);
}

beforeAll(async () => {
  const [device] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-till-move-${stamp()}`}, 'E2E till movements PC', 'Desktop')
    RETURNING dev_id`;
  deviceId = device.dev_id;
  const [device2] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-till-move2-${stamp()}`}, 'E2E till movements PC 2', 'Desktop')
    RETURNING dev_id`;
  device2Id = device2.dev_id;

  for (const d of await prisma.$queryRaw<{ tdn_id: string; v: string; k: string }[]>`
    SELECT tdn_id, tdn_value::int::text AS v, tdn_kind AS k FROM accounts.till_denomination
     WHERE tdn_company_id IS NULL AND tdn_is_deleted = false`) {
    denom[`${d.v}${d.k[0]}`] = d.tdn_id;
  }
  for (const r of await prisma.$queryRaw<{ trs_id: string; c: string; k: string }[]>`
    SELECT trs_id, trs_category AS c, trs_code AS k FROM accounts.till_reason
     WHERE trs_company_id IS NULL AND trs_is_deleted = false`) {
    reason[`${r.c}/${r.k}`] = r.trs_id;
  }
  const [cash] = await prisma.$queryRaw<{ tnd_ledger_id: string }[]>`
    SELECT tnd_ledger_id FROM accounts.acc_tender_master
     WHERE tnd_type_id = 1 AND tnd_company_id = ${COMPANY}::uuid
       AND (tnd_branch_id = ${BRANCH}::uuid OR tnd_branch_id IS NULL) AND tnd_is_active AND NOT tnd_is_deleted
     ORDER BY (tnd_branch_id IS NULL), tnd_is_default DESC, tnd_display_position, tnd_created_on LIMIT 1`;
  tillCashLedger = cash.tnd_ledger_id;
  const [income] = await prisma.$queryRaw<{ led_id: string }[]>`
    SELECT led_id FROM accounts.acc_ledger_master
     WHERE led_name = 'Stock Excess' AND led_company_id IS NULL AND NOT led_is_deleted`;
  incomeLedger = income.led_id;

  const [day] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid AND tbd_is_deleted = false`;
  dayCreated = day.n === 0;

  cashierRights = await grantMenuRights(prisma, TILL_MENUS, TESTER1);
  supervisorRights = await grantMenuRights(prisma, TILL_MENUS, SUPERVISOR);
  cashier2Rights = await grantMenuRights(prisma, TILL_MENUS, CASHIER2);
  await prisma.$executeRaw`
    UPDATE public.user_menus SET um_can_override = false
     WHERE um_user_id IN (${TESTER1}::uuid, ${CASHIER2}::uuid) AND um_menu_id = 273 AND um_is_deleted = false`;

  cashierApp = await bootApp({ device_id: deviceId });
  supervisorApp = await bootApp({ sub: SUPERVISOR, user_name: 'tester', user_type: 'USER', device_id: null });
  cashier2App = await bootApp({ sub: CASHIER2, user_name: 'prathap', user_type: 'USER', device_id: device2Id });

  const tag = stamp();
  const safe = await supervisor().post('safes/create', {
    tsfCompanyId: COMPANY,
    tsfBranchId: BRANCH,
    tsfCode: `E2EV${tag}`,
    tsfName: 'E2E movements safe',
  });
  expectStatus(safe, 201);
  safeId = safe.body.data.tsfId;
  const counter = await supervisor().post('counters/create', {
    tcnCompanyId: COMPANY,
    tcnBranchId: BRANCH,
    tcnCode: `E2EV${tag}`,
    tcnName: 'E2E movements counter',
    tcnDeviceId: deviceId,
    tcnSafeId: safeId,
    tcnDefaultFloat: 1000,
    tcnCashAlertLimit: 3000,
    tcnCashBlockLimit: 5000,
  });
  expectStatus(counter, 201);
  counterId = counter.body.data.tcnId;
  const counter2 = await supervisor().post('counters/create', {
    tcnCompanyId: COMPANY,
    tcnBranchId: BRANCH,
    tcnCode: `E2EW${tag}`,
    tcnName: 'E2E movements counter 2',
    tcnDeviceId: device2Id,
    tcnSafeId: safeId,
  });
  expectStatus(counter2, 201);
  counter2Id = counter2.body.data.tcnId;
}, 180_000);

afterAll(async () => {
  for (const sess of [session, session2]) {
    if (!sess) {
      continue;
    }
    const s = sess.tssId;
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ${s}::uuid OR tev_device_id = ${deviceId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ${s}::uuid`;
    await prisma.$executeRaw`DELETE FROM accounts.till_cash_movement WHERE tcm_session_id = ${s}::uuid`;
    // Every voucher of the session: the till's own and the void's mirror (no bill posts here).
    const vouchers = await prisma.$queryRaw<{ id: string; y: string }[]>`
      SELECT avh_voucher_id::text AS id, avh_acc_year AS y FROM accounts.acc_voucher_header
       WHERE avh_session_id = ${s}::uuid ORDER BY avh_reversal_voucher_id NULLS FIRST`;
    await prisma.$executeRaw`
      UPDATE accounts.acc_voucher_header SET avh_reversal_voucher_id = NULL, avh_reversal_acc_year = NULL
       WHERE avh_session_id = ${s}::uuid`;
    for (const v of vouchers) {
      await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id = ${v.id}::uuid AND av_acc_year = ${v.y}`;
    }
    for (const v of vouchers) {
      await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${v.id}::uuid AND avh_acc_year = ${v.y}`;
    }
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_id = ${s}::uuid`;
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_device_id = ${device2Id}::uuid`;
  if (dayCreated && session) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_day_id = ${session.tssDayId}::uuid`;
    await prisma.$executeRaw`
      DELETE FROM accounts.till_business_day d WHERE d.tbd_id = ${session.tssDayId}::uuid
         AND NOT EXISTS (SELECT 1 FROM accounts.till_session x WHERE x.tss_day_id = d.tbd_id)`;
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counter2Id ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_id = ${counterId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM accounts.till_safe WHERE tsf_id = ${safeId ?? null}::uuid`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id IN (${deviceId}::uuid, ${device2Id}::uuid)`;
  await restoreMenuRights(prisma, cashier2Rights);
  await restoreMenuRights(prisma, supervisorRights);
  await restoreMenuRights(prisma, cashierRights);
  await cashierApp?.close();
  await supervisorApp?.close();
  await cashier2App?.close();
  await prisma.$disconnect();
}, 120_000);

describe('Till movements, voids and cash limits', () => {
  it('opens a session with a 1000 float: the gauge is one quarter of the alert limit', async () => {
    const res = await cashier().post('sessions/open', {
      companyId: COMPANY,
      branchId: BRANCH,
      floatMode: 'ISSUED',
      floatIssued: 1000,
      lines: [{ tenderTypeId: 1, denominationId: denom['500N'], qty: 2 }],
    });
    expectStatus(res, 201);
    session = res.body.data;
    expect(res.body.data.cashLimit).toEqual({ state: 'NORMAL', gauge: 1, alertLimit: 3000, blockLimit: 5000 });
  });

  it('a paid-in needs a PAID_IN reason, and posts TPIn Dr till cash / Cr the ledger', async () => {
    const none = await cashier().post('movements/create', move({ kind: 'PAID_IN', amount: 100, ledgerId: incomeLedger }));
    expectStatus(none, 422);
    expect(none.body.errors[0].code).toBe('TILL_REASON_INVALID');
    const wrong = await cashier().post(
      'movements/create',
      move({ kind: 'PAID_IN', amount: 100, ledgerId: incomeLedger, reasonId: reason['PICKUP/CASH_LIMIT'] }),
    );
    expectStatus(wrong, 422);

    const res = await cashier().post(
      'movements/create',
      move({ kind: 'PAID_IN', amount: 2500, ledgerId: incomeLedger, reasonId: reason['PAID_IN/SCRAP'], partyName: 'Kabadiwala' }),
    );
    expectStatus(res, 201);
    ids.paidIn = res.body.data.tcmId;
    expect(res.body.data).toEqual(
      expect.objectContaining({ tcmKind: 'PAID_IN', tcmAmount: 2500, tcmLedgerId: incomeLedger, tcmStatus: 'POSTED' }),
    );
    const legs = await prisma.$queryRaw<{ dr_cr: string; ledger: string }[]>`
      SELECT av_dr_cr AS dr_cr, av_ledger_id::text AS ledger FROM accounts.acc_vouchers
       WHERE av_voucher_id = ${res.body.data.tcmVoucherId}::uuid ORDER BY av_row_no`;
    expect(legs).toEqual([
      { dr_cr: 'DR', ledger: tillCashLedger },
      { dr_cr: 'CR', ledger: incomeLedger },
    ]);
    expect(await cashLimit()).toEqual(expect.objectContaining({ state: 'ALERT', gauge: 4 }));
  });

  it('over the block limit the drawer is BLOCKED; a cashier cannot take a pickup', async () => {
    expectStatus(
      await cashier().post(
        'movements/create',
        move({ kind: 'PAID_IN', amount: 2000, ledgerId: incomeLedger, reasonId: reason['PAID_IN/SCRAP'] }),
      ),
      201,
    );
    expect((await cashLimit()).state).toBe('BLOCKED');
    const res = await cashier().post(
      'movements/create',
      move({ kind: 'PICKUP', lines: [{ tenderTypeId: 1, denominationId: denom['500N'], qty: 6 }], reasonId: reason['PICKUP/CASH_LIMIT'] }),
    );
    expectStatus(res, 403);
    expect(res.body.errors[0].code).toBe('TILL_RIGHT_OVERRIDE');
  });

  it('the supervisor’s pickup of 3000 (TDrp) is witnessed by the cashier and unblocks the drawer', async () => {
    const res = await supervisor().post(
      'movements/create',
      move({ kind: 'PICKUP', lines: [{ tenderTypeId: 1, denominationId: denom['500N'], qty: 6 }], reasonId: reason['PICKUP/CASH_LIMIT'] }),
    );
    expectStatus(res, 201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ tcmKind: 'PICKUP', tcmAmount: 3000, tcmDoneBy: SUPERVISOR, tcmWitnessBy: TESTER1, tcmSafeId: safeId }),
    );
    expect(res.body.data.counts).toEqual([expect.objectContaining({ tctKind: 'PICKUP', tctTotalCounted: 3000 })]);
    expect(await cashLimit()).toEqual(expect.objectContaining({ state: 'NORMAL', gauge: 3 }));
  });

  it('a top-up brings 200 of change (TFlt); a drop is a sealed bag of a declared amount', async () => {
    const top = await supervisor().post(
      'movements/create',
      move({ kind: 'TOP_UP', lines: [{ tenderTypeId: 1, denominationId: denom['100N'], qty: 2 }] }),
    );
    expectStatus(top, 201);
    expect(top.body.data.counts[0]).toEqual(expect.objectContaining({ tctKind: 'FLOAT_ISSUE', tctTotalCounted: 200 }));

    const counted = await cashier().post(
      'movements/create',
      move({ kind: 'DROP', lines: [{ tenderTypeId: 1, denominationId: denom['500N'], qty: 2 }] }),
    );
    expectStatus(counted, 422);
    const drop = await cashier().post('movements/create', move({ kind: 'DROP', amount: 1000, bagNo: 'B-17', sealNo: 'S-9017' }));
    expectStatus(drop, 201);
    ids.drop = drop.body.data.tcmId;
    expect(drop.body.data).toEqual(expect.objectContaining({ tcmKind: 'DROP', tcmBagNo: 'B-17', tcmSealNo: 'S-9017' }));
  });

  it('an exchange counts both sides, books nothing and is numbered in the session', async () => {
    const unequal = await cashier().post(
      'movements/create',
      move({
        kind: 'EXCHANGE',
        lines: [{ tenderTypeId: 1, denominationId: denom['500N'], qty: 1 }],
        outLines: [{ tenderTypeId: 1, denominationId: denom['100N'], qty: 4 }],
      }),
    );
    expectStatus(unequal, 422);
    const res = await cashier().post(
      'movements/create',
      move({
        kind: 'EXCHANGE',
        lines: [{ tenderTypeId: 1, denominationId: denom['500N'], qty: 1 }],
        outLines: [{ tenderTypeId: 1, denominationId: denom['100N'], qty: 5 }],
      }),
    );
    expectStatus(res, 201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ tcmKind: 'EXCHANGE', tcmVoucherId: null, tcmDocNo: `${session.tssSessionNo}/X1` }),
    );
    expect(res.body.data.counts.map((c: { tctKind: string }) => c.tctKind).sort()).toEqual(['FLOAT_ISSUE', 'PICKUP']);
  });

  it('the supervisor voids the drop: its voucher mirrored, the row VOIDED; the open’s float is not voidable', async () => {
    expectStatus(
      await cashier().post('movements/void', {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: session.tssAccYear,
        tcmId: ids.drop,
        reasonId: reason['MOVEMENT_VOID/DUPLICATE'],
      }),
      403,
    );
    const res = await supervisor().post('movements/void', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      tcmId: ids.drop,
      reasonId: reason['MOVEMENT_VOID/DUPLICATE'],
    });
    expectStatus(res, 200);
    expect(res.body.data).toEqual(expect.objectContaining({ tcmStatus: 'VOIDED', tcmVoidedBy: SUPERVISOR }));
    const [original] = await prisma.$queryRaw<{ status: string; reversal: string | null }[]>`
      SELECT avh_voucher_status AS status, avh_reversal_voucher_id::text AS reversal FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${res.body.data.tcmVoucherId}::uuid`;
    expect(original.status).toBe('CANCELLED');
    expect(original.reversal).not.toBeNull();

    const again = await supervisor().post('movements/void', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      tcmId: ids.drop,
      reasonId: reason['MOVEMENT_VOID/DUPLICATE'],
    });
    expectStatus(again, 409);

    const [float] = await prisma.$queryRaw<{ tcm_id: string }[]>`
      SELECT tcm_id::text FROM accounts.till_cash_movement WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_kind = 'FLOAT_ISSUE'`;
    const floatVoid = await supervisor().post('movements/void', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      tcmId: float.tcm_id,
      reasonId: reason['MOVEMENT_VOID/DUPLICATE'],
    });
    expectStatus(floatVoid, 409);
    expect(floatVoid.body.errors[0].code).toBe('TILL_MOVEMENT_NOT_VOIDABLE');
  });

  it('REV 2 §2.14 — change from this counter to another is a PICKUP here and a TOP_UP there, in one call', async () => {
    const open2 = await cashier2().post('sessions/open', { companyId: COMPANY, branchId: BRANCH, floatMode: 'NONE', lines: [] });
    expectStatus(open2, 201);
    session2 = open2.body.data;

    const res = await supervisor().post('movements/change', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      fromTssId: session.tssId,
      toTssId: session2.tssId,
      lines: [{ tenderTypeId: 1, denominationId: denom['100N'], qty: 2 }],
      reasonId: reason['PICKUP/SCHEDULED'],
    });
    expectStatus(res, 201);
    expect(res.body.data.from).toEqual(
      expect.objectContaining({ tcmKind: 'PICKUP', tcmAmount: 200, tcmSessionId: session.tssId, tcmWitnessBy: TESTER1 }),
    );
    expect(res.body.data.to).toEqual(
      expect.objectContaining({ tcmKind: 'TOP_UP', tcmAmount: 200, tcmSessionId: session2.tssId, tcmWitnessBy: CASHIER2 }),
    );
    expect(res.body.data.from.tcmVoucherId).not.toBeNull();
    expect(res.body.data.to.tcmVoucherId).not.toBeNull();
  });

  it('REV 2 §2.6 — end billing waits for the device’s unsent documents, and logs the attempt', async () => {
    const outbox = await cashier().post('sessions/end-billing', { ...key(), outboxCount: 2 });
    expectStatus(outbox, 409);
    expect(outbox.body.errors[0]).toEqual(expect.objectContaining({ code: 'TILL_DEVICE_UNSYNCED', outboxCount: 2 }));
    const behind = await cashier().post('sessions/end-billing', { ...key(), outboxCount: 0, lastClientSeq: 99 });
    expectStatus(behind, 409);
    const logged = await prisma.tillEvent.count({
      where: { tevSessionId: session.tssId, tevEventCode: 'SYNC_PENDING_AT_CLOSE' },
    });
    expect(logged).toBe(2);
    expect((await cashLimit()).state).toBe('NORMAL'); // still billing: the refused end changed nothing
  });

  it('once billing ends nothing moves; the count expects 2500 and the books net to the float left', async () => {
    expectStatus(await cashier().post('sessions/end-billing', { ...key(), outboxCount: 0 }), 200);

    // REV 2 §2.8: COUNTING is still live for a void, until a count is final.
    const [exchange] = await prisma.$queryRaw<{ tcm_id: string }[]>`
      SELECT tcm_id::text FROM accounts.till_cash_movement WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_kind = 'EXCHANGE'`;
    const voidInCounting = await supervisor().post('movements/void', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      tcmId: exchange.tcm_id,
      reasonId: reason['MOVEMENT_VOID/KEYED_WRONG'],
      notes: 'denominations keyed the wrong way round',
    });
    expectStatus(voidInCounting, 200);
    expect(voidInCounting.body.data).toEqual(expect.objectContaining({ tcmStatus: 'VOIDED', tcmVoucherId: null }));
    const late = await cashier().post('movements/create', move({ kind: 'DROP', amount: 100 }));
    expectStatus(late, 409);
    expect(late.body.errors[0].code).toBe('TILL_SESSION_NOT_OPEN');

    // 1000 float + 4500 paid in + 200 top-up − 3000 pickup − 200 change to counter 2
    // (the drop and the exchange were voided) = 2500
    const count = await cashier().post('sessions/count', {
      ...key(),
      lines: [{ tenderTypeId: 1, denominationId: denom['500N'], qty: 5 }],
    });
    expectStatus(count, 200);
    expect(count.body.data.outcome).toBe('ACCEPTED');

    // …and after the final count, a void would change a frozen expectation.
    const [topUp] = await prisma.$queryRaw<{ tcm_id: string }[]>`
      SELECT tcm_id::text FROM accounts.till_cash_movement
       WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_kind = 'TOP_UP' AND tcm_status = 'POSTED'`;
    const voidAfterCount = await supervisor().post('movements/void', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: session.tssAccYear,
      tcmId: topUp.tcm_id,
      reasonId: reason['MOVEMENT_VOID/DUPLICATE'],
    });
    expectStatus(voidAfterCount, 409);
    expect(voidAfterCount.body.errors[0].code).toBe('TILL_MOVEMENT_SESSION_CLOSED');

    const close = await cashier().post('sessions/close', { ...key(), floatLeft: 0 });
    expectStatus(close, 200);
    const cash = close.body.data.tenders.find((t: { tenderTypeId: number }) => t.tenderTypeId === 1);
    expect(cash).toEqual(expect.objectContaining({ openAmount: 1000, movedIn: 4700, movedOut: 3200, expected: 2500, counted: 2500 }));
    expect(close.body.data.totals.handedOver).toBe(2500);
    expect(close.body.data.cashLimit).toBeNull();
    expect(await tillCashNet()).toBe(0);
  });
});
