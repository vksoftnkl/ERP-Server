import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';

import { as, bootIdentityApp, TESTER } from './helpers/identity-app';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from './helpers/menu-rights';
import {
  ACC_YEAR,
  ACTOR,
  BRANCH,
  COMPANY,
  data,
  expectStatus,
  prisma,
} from './helpers/payment-e2e';
import { DaySummaryService } from '../src/modules/reports/day-summary/day-summary.service';
import type {
  CheckDetailPayload,
  DailyPayload,
  ExportPayload,
  GroupLedgersPayload,
  SidedAmount,
  SummaryPayload,
  TypeRow,
  VouchersPayload,
  VoucherTypesPayload,
} from '../src/modules/reports/day-summary/types/day-summary.types';
import type { LedgerHeaderPayload } from '../src/modules/reports/ledger-statement/types/ledger-statement.types';

/**
 * Account Day Summary — Prathap/report/plan-backend-account-day-summary.md.
 *
 * Two halves:
 *
 *  1. HTTP against the dev database (the real guard, validation pipe and
 *     filters), READ-ONLY apart from the user_menus fixture: tester1 is granted
 *     284 (and 258, for the Ledger Statement cross-check) before the first
 *     request and put back after the last. The box's rows are test data, so
 *     nothing is hard-coded: the report is reconciled with itself (§8.1), with
 *     a brute-force SQL of the pair rule (§4.1), and with the Ledger Statement
 *     (§11 item 11).
 *
 *  2. The plan's §11 scenarios on SYNTHETIC vouchers (ZT-DS-) written inside a
 *     transaction that is always rolled back, with the service's own pipeline
 *     run on that transaction — the pair rule's lone halves never occur in the
 *     real data (every mirror shares its original's date).
 *
 *     npm run test:e2e -- day-summary-http --runInBand
 */

jest.setTimeout(300_000);

const MENU = 284;
const STATEMENT_MENU = 258;
const DAY_BOOK_DETAIL = 181;
const BASE = '/api/v1/reports/day-summary';

let app: INestApplication;
let rights: MenuRightsMemo | null = null;
let busyDays: string[] = [];

const get = (path: string, query: Record<string, unknown>, auth = 'Bearer dummy-test-token') =>
  request(app.getHttpServer()).get(`${BASE}/${path}`).query(query).set('Authorization', auth);

async function ok<T>(path: string, query: Record<string, unknown>): Promise<T> {
  const res = await get(path, query);
  expectStatus(res, 200);
  return data<T>(res);
}

async function refused(path: string, query: Record<string, unknown>, status: number, code: string) {
  const res = await get(path, query);
  expectStatus(res, status);
  // AllExceptionsFilter wraps the exception body in `message`.
  const body = res.body as { message?: { errors?: { code?: string }[] } };
  expect((body.message?.errors ?? []).map((e) => e.code)).toContain(code);
}

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const signed = (b: SidedAmount | null) =>
  b === null ? D(0) : D(b.amount).times(b.side === 'CR' ? -1 : 1);
const sum = <T>(rows: T[], pick: (r: T) => string) =>
  rows.reduce((acc, r) => acc.plus(pick(r)), D(0)).toFixed(2);

beforeAll(async () => {
  app = await bootIdentityApp();
  rights = await grantMenuRights(prisma, [MENU, STATEMENT_MENU]);
  busyDays = (
    await prisma.$queryRaw<{ d: Date }[]>`
      SELECT avh_voucher_date AS d FROM accounts.acc_voucher_header
       WHERE avh_company_id = ${COMPANY}::uuid AND avh_acc_year = ${ACC_YEAR}::char(9)
         AND avh_is_deleted = false AND avh_voucher_status IN ('POSTED', 'CANCELLED')
       GROUP BY 1 ORDER BY COUNT(*) DESC, 1 LIMIT 3`
  ).map((r) => r.d.toISOString().slice(0, 10));
});

afterAll(async () => {
  await restoreMenuRights(prisma, rights);
  await app?.close();
  await prisma.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════
//  1. HTTP
// ═══════════════════════════════════════════════════════════════════════════

describe('guards and refusals (§9, §10)', () => {
  const q = () => ({ companyId: COMPANY, accYear: ACC_YEAR, fromDate: busyDays[0] });

  it('403 NO_MENU_RIGHT without view on 284 or 181; 181 alone is enough (D8)', async () => {
    const [held] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM public.user_menus
       WHERE um_user_id = ${TESTER}::uuid AND um_menu_id IN (${MENU}::int, ${DAY_BOOK_DETAIL}::int)
         AND um_can_view AND NOT um_is_deleted`;
    if (Number(held.n) > 0) {
      return; // someone granted 'tester' the report on this box
    }
    for (const path of ['voucher-types', 'summary', 'vouchers', 'daily', 'export']) {
      const res = await get(path, path === 'voucher-types' ? {} : q(), as('tester', ''));
      expectStatus(res, 403);
      expect(JSON.stringify(res.body)).toContain('NO_MENU_RIGHT');
    }
    const memo = await grantMenuRights(prisma, [DAY_BOOK_DETAIL], TESTER);
    try {
      expectStatus(await get('summary', q(), as('tester', '')), 200);
    } finally {
      await restoreMenuRights(prisma, memo);
    }
  });

  it('400 on a malformed key', async () => {
    expectStatus(await get('summary', { ...q(), fromDate: '09-10-2026' }), 400);
    expectStatus(await get('summary', { ...q(), fromDate: '2026-02-30' }), 400);
    expectStatus(await get('summary', { ...q(), groupLevel: 'ROOT' }), 400);
    expectStatus(await get('vouchers', { ...q(), pageSize: 501 }), 400);
    expectStatus(await get('vouchers', { ...q(), moneyKind: 'CARD' }), 400);
    expectStatus(await get('summary', { ...q(), ledgerId: COMPANY }), 400);
  });

  it('400 with the plan’s codes', async () => {
    await refused('summary', { ...q(), accYear: '2001-2002' }, 400, 'YEAR_UNKNOWN');
    await refused(
      'summary',
      { ...q(), toDate: '2026-04-01', fromDate: '2026-04-02' },
      400,
      'RANGE_REVERSED',
    );
    await refused('summary', { ...q(), fromDate: '2027-04-01' }, 400, 'RANGE_OUTSIDE_YEAR');
    await refused('summary', { ...q(), voucherTypeId: 99999 }, 400, 'TYPE_UNKNOWN');
    const [other] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT br_id AS id FROM public.branch_master WHERE br_comp_id <> ${COMPANY}::uuid LIMIT 1`;
    if (other) {
      await refused('summary', { ...q(), branchId: other.id }, 400, 'BRANCH_NOT_IN_COMPANY');
    }
    await refused('group-ledgers', { ...q(), groupId: COMPANY }, 400, 'GROUP_UNKNOWN');
    await refused('checks/detail', { ...q(), code: 'NOPE' }, 400, 'CHECK_UNKNOWN');
  });
});

describe('the snapshot (§5.2)', () => {
  it('runs every route in one read-only REPEATABLE READ transaction', async () => {
    const svc = app.get<
      DaySummaryService,
      { snapshot<R>(work: (db: Prisma.TransactionClient) => Promise<R>): Promise<R> }
    >(DaySummaryService);
    const [row] = await svc.snapshot(
      (db) =>
        db.$queryRaw<{ iso: string; ro: string }[]>`
        SELECT current_setting('transaction_isolation') AS iso,
               current_setting('transaction_read_only') AS ro`,
    );
    expect(row).toEqual({ iso: 'repeatable read', ro: 'on' });
  });
});

describe('voucher types (§5.1, D4)', () => {
  it('lists the posting types and leaves out Quo / SOr', async () => {
    const t = await ok<VoucherTypesPayload>('voucher-types', {});
    const codes = t.items.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(['Bil', 'Rct', 'OPENING', 'Phy', 'StkAdj', 'Rev']),
    );
    expect(codes).not.toContain('Quo');
    expect(codes).not.toContain('SOr');
    const orders = t.items.map((i) => i.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});

describe('the summary reconciles with itself and with a brute-force pair rule (§4, §8.1)', () => {
  it.each([0, 1, 2])('busy day #%i', async (i) => {
    const day = busyDays[i];
    if (!day) {
      return;
    }
    const s = await ok<SummaryPayload>('summary', {
      companyId: COMPANY,
      accYear: ACC_YEAR,
      fromDate: day,
    });
    expect(s.scope).toMatchObject({ fromDate: day, toDate: day, days: 1, branchId: null });
    const check = (code: string) => s.checks.find((c) => c.code === code);
    expect(check('BALANCED')?.level).toBe('OK');
    expect(check('AMOUNT_TIES')?.level).toBe('OK');

    // Σ type amount = Σ group Dr = Σ group Cr, and the totals are the rows' sums.
    expect(s.typeTotals.amount).toBe(sum(s.types, (t) => t.amount));
    expect(s.groupTotals.debit).toBe(s.typeTotals.amount);
    expect(s.groupTotals.credit).toBe(s.typeTotals.amount);
    expect(sum(s.groups, (g) => g.debit)).toBe(s.groupTotals.debit);
    expect(s.typeTotals.vouchers).toBe(s.types.reduce((n, t) => n + t.vouchers, 0));
    for (const k of ['cashIn', 'cashOut', 'bankIn', 'bankOut'] as const) {
      expect(s.typeTotals[k]).toBe(sum(s.types, (t) => t[k]));
    }

    // The pair rule, said differently: from the headers, not the legs CTE.
    const brute = await prisma.$queryRaw<
      { vt: number; n: bigint; pairs: bigint; amt: Prisma.Decimal }[]
    >`
      WITH h AS (
        SELECT h.* FROM accounts.acc_voucher_header h
         WHERE h.avh_company_id = ${COMPANY}::uuid AND h.avh_acc_year = ${ACC_YEAR}::char(9)
           AND h.avh_voucher_date = ${day}::date AND h.avh_is_deleted = false
           AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
           AND EXISTS (SELECT 1 FROM accounts.acc_vouchers v
                        WHERE v.av_voucher_id = h.avh_voucher_id AND v.av_acc_year = h.avh_acc_year
                          AND NOT v.av_is_deleted)),
      x AS (
        SELECT h.avh_voucher_id, h.avh_acc_year, h.avh_voucher_type_id, h.avh_voucher_status,
               CASE WHEN h.avh_voucher_status = 'CANCELLED'
                    THEN EXISTS (SELECT 1 FROM h m WHERE m.avh_voucher_id = h.avh_reversal_voucher_id)
                    ELSE EXISTS (SELECT 1 FROM h o WHERE o.avh_reversal_voucher_id = h.avh_voucher_id
                                                     AND o.avh_voucher_status = 'CANCELLED') END AS paired
          FROM h)
      SELECT x.avh_voucher_type_id AS vt,
             COUNT(*) FILTER (WHERE NOT x.paired) AS n,
             COUNT(*) FILTER (WHERE x.paired AND x.avh_voucher_status = 'CANCELLED') AS pairs,
             COALESCE(SUM((SELECT SUM(v.av_amount) FROM accounts.acc_vouchers v
                            WHERE v.av_voucher_id = x.avh_voucher_id AND v.av_acc_year = x.avh_acc_year
                              AND v.av_dr_cr = 'DR' AND NOT v.av_is_deleted)) FILTER (WHERE NOT x.paired), 0) AS amt
        FROM x GROUP BY 1`;
    const byType = new Map(s.types.map((t) => [t.voucherTypeId, t]));
    for (const b of brute) {
      const row = byType.get(b.vt);
      expect({
        vt: b.vt,
        n: row?.vouchers ?? 0,
        pairs: row?.cancelledPairs ?? 0,
        amt: row?.amount ?? '0.00',
      }).toEqual({
        vt: b.vt,
        n: Number(b.n),
        pairs: Number(b.pairs),
        amt: D(b.amt).toFixed(2),
      });
    }

    // Tiles are the type rows summed by nature (§6.4).
    const tile = (code: string) => s.tiles.find((t) => t.code === code);
    expect(tile('SALES')?.amount).toBe(
      sum(
        s.types.filter((t) => t.nature === 'SALES'),
        (t) => t.amount,
      ),
    );
    expect(tile('EXPENSES')?.amount).toBe(
      sum(
        s.types.filter((t) => t.code === 'ExpV'),
        (t) => t.amount,
      ),
    );
    const cash = tile('CASH_IN_HAND');
    expect(
      signed(cash?.closing ?? null)
        .minus(signed(cash?.opening ?? null))
        .toFixed(2),
    ).toBe(signed(cash?.net ?? null).toFixed(2));
  });
});

describe('money ledgers agree with the Ledger Statement (§11 item 11)', () => {
  it('opening and closing of every money ledger, All branches and one branch', async () => {
    const day = busyDays[0];
    for (const branchId of [undefined, BRANCH]) {
      const q = { companyId: COMPANY, accYear: ACC_YEAR, fromDate: day, branchId };
      const s = await ok<SummaryPayload>('summary', { ...q, zeroRows: true });
      expect(s.moneyLedgers.length).toBeGreaterThan(0);
      for (const m of s.moneyLedgers) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/reports/ledger-statement/header')
          .query({ ...q, toDate: day, ledgerId: m.ledgerId })
          .set('Authorization', 'Bearer dummy-test-token');
        if (res.status === 404) {
          continue; // a soft-deleted money ledger that still moved: the statement refuses it
        }
        expectStatus(res, 200);
        const ls = data<LedgerHeaderPayload>(res);
        expect({ id: m.ledgerId, opening: m.opening, closing: m.closing }).toEqual({
          id: m.ledgerId,
          opening: ls.period.opening,
          closing: ls.period.closing,
        });
        expect(m.openingNote).toBe(ls.period.openingNote);
      }
    }
  });
});

describe('branches, type filter, day-wise (§11 items 8–10)', () => {
  it('All branches = Σ of each branch, type by type', async () => {
    const day = busyDays[0];
    const q = { companyId: COMPANY, accYear: ACC_YEAR, fromDate: day };
    const all = await ok<SummaryPayload>('summary', q);
    const branches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT br_id AS id FROM public.branch_master WHERE br_comp_id = ${COMPANY}::uuid`;
    const acc = new Map<number, { n: number; amt: Prisma.Decimal }>();
    for (const b of branches) {
      const one = await ok<SummaryPayload>('summary', { ...q, branchId: b.id });
      for (const t of one.types) {
        const cur = acc.get(t.voucherTypeId) ?? { n: 0, amt: D(0) };
        acc.set(t.voucherTypeId, { n: cur.n + t.vouchers, amt: cur.amt.plus(t.amount) });
      }
    }
    for (const t of all.types) {
      expect([
        t.voucherTypeId,
        acc.get(t.voucherTypeId)?.n ?? 0,
        (acc.get(t.voucherTypeId)?.amt ?? D(0)).toFixed(2),
      ]).toEqual([t.voucherTypeId, t.vouchers, t.amount]);
    }
  });

  it('a voucherTypeId filter returns exactly that type’s unfiltered row; balances become null', async () => {
    const day = busyDays[0];
    const q = { companyId: COMPANY, accYear: ACC_YEAR, fromDate: day };
    const all = await ok<SummaryPayload>('summary', q);
    for (const t of all.types) {
      const one = await ok<SummaryPayload>('summary', { ...q, voucherTypeId: t.voucherTypeId });
      expect(one.types).toEqual([t]);
      expect(one.moneyTotals.CASH.opening).toBeNull();
      expect(one.checks.find((c) => c.code === 'BALANCED')?.level).toBe('OK');
      expect(one.checks.find((c) => c.code === 'AMOUNT_TIES')?.level).toBe('OK');
    }
  });

  it('day-wise closings chain and end on the /summary closing', async () => {
    const days = [...busyDays].sort();
    const q = {
      companyId: COMPANY,
      accYear: ACC_YEAR,
      fromDate: days[0],
      toDate: days[days.length - 1],
    };
    const daily = await ok<DailyPayload>('daily', { ...q, zeroRows: true });
    const s = await ok<SummaryPayload>('summary', q);
    let cash = signed(daily.cashOpening);
    let bank = signed(daily.bankOpening);
    expect(daily.cashOpening).toEqual(s.moneyTotals.CASH.opening);
    for (const d of daily.days) {
      cash = cash.plus(d.cashIn).minus(d.cashOut);
      bank = bank.plus(d.bankIn).minus(d.bankOut);
      expect(signed(d.cashClosing).toFixed(2)).toBe(cash.toFixed(2));
      expect(signed(d.bankClosing).toFixed(2)).toBe(bank.toFixed(2));
    }
    expect(daily.days.length).toBe(s.scope.days);
    expect(daily.days[daily.days.length - 1].cashClosing).toEqual(s.moneyTotals.CASH.closing);
    const bankish = signed(s.moneyTotals.BANK.closing).plus(signed(s.moneyTotals.CLEARING.closing));
    expect(signed(daily.days[daily.days.length - 1].bankClosing).toFixed(2)).toBe(
      bankish.toFixed(2),
    );
  });
});

describe('vouchers, groups, checks, export (§5.3–§5.7)', () => {
  const q = () => ({ companyId: COMPANY, accYear: ACC_YEAR, fromDate: busyDays[0] });

  it('/vouchers without pairs is the /summary set; with pairs adds both halves', async () => {
    const s = await ok<SummaryPayload>('summary', q());
    const without = await ok<VouchersPayload>('vouchers', {
      ...q(),
      includeCancelledPairs: false,
      pageSize: 1,
    });
    expect(without.page.totalRows).toBe(s.typeTotals.vouchers);
    expect(without.totals.amount).toBe(s.typeTotals.amount);
    const withPairs = await ok<VouchersPayload>('vouchers', { ...q(), pageSize: 1 });
    expect(withPairs.page.totalRows).toBe(s.typeTotals.vouchers + 2 * s.typeTotals.cancelledPairs);
  });

  it('pages cover the set once, in order', async () => {
    const all: string[] = [];
    let total = 0;
    for (let page = 1; ; page += 1) {
      const v = await ok<VouchersPayload>('vouchers', { ...q(), page, pageSize: 97 });
      total = v.page.totalRows;
      all.push(...v.rows.map((r) => r.voucherId));
      if (v.rows.length === 0 || all.length >= total) {
        break;
      }
    }
    expect(all.length).toBe(total);
    expect(new Set(all).size).toBe(total);
  });

  it('moneyKind=CASH lists only vouchers with a cash leg', async () => {
    const s = await ok<SummaryPayload>('summary', { ...q(), zeroRows: true });
    const cashIds = new Set(s.moneyLedgers.filter((m) => m.kind === 'CASH').map((m) => m.ledgerId));
    const v = await ok<VouchersPayload>('vouchers', {
      ...q(),
      moneyKind: 'CASH',
      withLegs: true,
      pageSize: 500,
    });
    if (v.draftsOnly) {
      throw new Error('expected vouchers');
    }
    for (const row of v.rows) {
      expect(row.legs?.some((leg) => cashIds.has(leg.ledgerId))).toBe(true);
      expect(
        sum(
          row.legs!.filter((l) => l.side === 'DR'),
          (l) => l.amount,
        ),
      ).toBe(row.amount);
    }
  });

  it('draftsOnly returns the drafts the DRAFTS check counts', async () => {
    const s = await ok<SummaryPayload>('summary', q());
    const drafts = s.checks.find((c) => c.code === 'DRAFTS');
    const v = await ok<VouchersPayload>('vouchers', { ...q(), draftsOnly: true, pageSize: 500 });
    expect(v.draftsOnly).toBe(true);
    expect(v.page.totalRows).toBe(drafts?.facts.count);
    expect(v.totals.amount).toBe(drafts?.facts.amount);
  });

  it('group-ledgers sum to their group row, at every level', async () => {
    for (const groupLevel of ['REPORT', 'PRIMARY', 'LEDGER_GROUP']) {
      const s = await ok<SummaryPayload>('summary', { ...q(), groupLevel });
      expect(s.groupTotals.debit).toBe(s.typeTotals.amount);
      for (const g of s.groups.slice(0, 6)) {
        const gl = await ok<GroupLedgersPayload>('group-ledgers', {
          ...q(),
          groupLevel,
          groupId: g.groupId,
        });
        expect([g.groupName, gl.totals]).toEqual([
          g.groupName,
          { debit: g.debit, credit: g.credit },
        ]);
      }
    }
  });

  it('every check code has a detail route', async () => {
    const codes = [
      'BALANCED',
      'AMOUNT_TIES',
      'LEGLESS',
      'DRAFTS',
      'CANCELLED_PAIRS',
      'CLEARING_PENDING',
      'BUSINESS_DAY',
      'FUTURE_DATED',
      'NUMBER_GAPS',
    ];
    const s = await ok<SummaryPayload>('summary', q());
    for (const code of codes) {
      const d = await ok<CheckDetailPayload>('checks/detail', { ...q(), code: code.toLowerCase() });
      expect(d.code).toBe(code);
      if (code === 'BALANCED' || code === 'AMOUNT_TIES') {
        expect(d.rows).toEqual([]);
      }
      const c = s.checks.find((x) => x.code === code);
      if (code === 'LEGLESS' || code === 'DRAFTS') {
        expect(d.rows.length).toBe(Math.min(Number(c?.facts.count), 500));
      }
    }
  });

  it('/export = /summary + every voucher row', async () => {
    const e = await ok<ExportPayload>('export', q());
    const s = await ok<SummaryPayload>('summary', q());
    expect({ ...e.summary, scope: { ...e.summary.scope, asOf: '' } }).toEqual({
      ...s,
      scope: { ...s.scope, asOf: '' },
    });
    const v = await ok<VouchersPayload>('vouchers', { ...q(), pageSize: 1 });
    expect(e.totalRows).toBe(v.page.totalRows);
    expect(e.vouchers.length).toBe(v.page.totalRows);
    expect(e.vouchers.every((r) => Array.isArray(r.legs))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. Synthetic scenarios (§11 items 2–7, 9–10), always rolled back
// ═══════════════════════════════════════════════════════════════════════════

/** The service's private pipeline, driven on the test's own transaction. */
interface Pipeline {
  resolveScope(db: Prisma.TransactionClient, q: Record<string, unknown>): Promise<unknown>;
  loadBooks(db: Prisma.TransactionClient, scope: unknown): Promise<unknown>;
  buildSummary(
    db: Prisma.TransactionClient,
    scope: unknown,
    books: unknown,
  ): Promise<SummaryPayload>;
  buildDaily(db: Prisma.TransactionClient, scope: unknown, books: unknown): Promise<DailyPayload>;
  buildVouchers(
    db: Prisma.TransactionClient,
    scope: unknown,
    books: unknown,
    q: Record<string, unknown>,
  ): Promise<VouchersPayload>;
}

const D1 = '2027-03-29';
const D2 = '2027-03-30';
const ROLLBACK = new Error('ZT-DS rollback');
const T = { Bil: 3, Jrl: 24, Rev: 23, Con: 25, ExpV: 40 } as const;

interface Leg {
  ledger: string;
  side: 'DR' | 'CR';
  amount: number;
}

describe('synthetic day book (ZT-DS-, rolled back)', () => {
  let cash: string;
  let bank: string;
  let sales: string;
  let x: string;
  let y: string;
  let slno = 990_000_000;

  beforeAll(async () => {
    const pick = async (where: Prisma.Sql) => {
      const [r] = await prisma.$queryRaw<{ id: string }[]>`
        SELECT l.led_id AS id FROM accounts.acc_ledger_master l
          JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
         WHERE l.led_is_deleted = false
           AND (l.led_company_id IS NULL OR l.led_company_id = ${COMPANY}::uuid)
           AND ${where}
         ORDER BY l.led_name LIMIT 1`;
      return r.id;
    };
    cash = await pick(Prisma.sql`g.acc_ledger_profile = 'Cash'`);
    bank = await pick(Prisma.sql`g.acc_ledger_profile = 'Bank'`);
    sales = await pick(Prisma.sql`g.acc_group_name = 'Sales Accounts'`);
    x = await pick(Prisma.sql`g.acc_group_name = 'Indirect Expenses'`);
    y = await pick(
      Prisma.sql`g.acc_group_name = 'Indirect Incomes' OR g.acc_group_name = 'Duties & Taxes'`,
    );
  });

  async function voucher(
    tx: Prisma.TransactionClient,
    v: {
      type: number;
      date: string;
      status: 'POSTED' | 'CANCELLED' | 'DRAFT';
      legs: Leg[];
      reversalId?: string;
      docAmount?: number;
    },
  ): Promise<string> {
    slno += 1;
    const draft = v.status === 'DRAFT';
    const [h] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO accounts.acc_voucher_header
             (avh_company_id, avh_branch_id, avh_acc_year, avh_voucher_type_id, avh_voucher_no,
              avh_voucher_slno, avh_voucher_refno, avh_voucher_date, avh_voucher_status,
              avh_posted_on, avh_status_on, avh_status_by, avh_cancel_reason, avh_user_id,
              avh_reversal_voucher_id, avh_reversal_acc_year, avh_doc_amount, avh_remarks,
              avh_created_by)
      VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${ACC_YEAR}::char(9), ${v.type}::int,
              ${draft ? null : slno}::bigint, ${draft ? null : slno}::bigint,
              ${draft ? null : `ZT-DS-${slno}`}, ${v.date}::date, ${v.status},
              ${v.status === 'POSTED' ? new Date() : null}::timestamptz,
              ${draft ? null : new Date()}::timestamptz, ${draft ? null : ACTOR}::uuid,
              ${v.status === 'CANCELLED' ? 'ZT-DS cancel' : null},
              ${ACTOR}::uuid, ${v.reversalId ?? null}::uuid,
              ${v.reversalId ? ACC_YEAR : null}::char(9), ${v.docAmount ?? 0}::numeric,
              'ZT-DS synthetic', ${ACTOR})
      RETURNING avh_voucher_id AS id`;
    if (v.legs.length > 0) {
      // One statement: the totals trigger runs at its end, so ck_avh_balanced sees both sides.
      await tx.$executeRaw`
        INSERT INTO accounts.acc_vouchers
               (av_voucher_id, av_company_id, av_branch_id, av_acc_year, av_voucher_type_id,
                av_voucher_no, av_row_no, av_voucher_date, av_dr_cr, av_ledger_id, av_amount,
                av_user_id)
        VALUES ${Prisma.join(
          v.legs.map(
            (leg, i) => Prisma.sql`(${h.id}::uuid, ${COMPANY}::uuid, ${BRANCH}::uuid,
              ${ACC_YEAR}::char(9), ${v.type}::int, ${slno}::bigint, ${i + 1}::int, ${v.date}::date,
              ${leg.side}::char(2), ${leg.ledger}::uuid, ${leg.amount}::numeric, ${ACTOR}::uuid)`,
          ),
        )}`;
    }
    return h.id;
  }

  /** A cancel: the POSTED mirror (opposite legs) first, then the CANCELLED original naming it. */
  async function cancelled(
    tx: Prisma.TransactionClient,
    v: { type: number; date: string; legs: Leg[]; mirrorType: number; mirrorDate: string },
  ): Promise<{ original: string; mirror: string }> {
    const flip = (l: Leg): Leg => ({ ...l, side: l.side === 'DR' ? 'CR' : 'DR' });
    const mirror = await voucher(tx, {
      type: v.mirrorType,
      date: v.mirrorDate,
      status: 'POSTED',
      legs: v.legs.map(flip),
    });
    const original = await voucher(tx, {
      type: v.type,
      date: v.date,
      status: 'CANCELLED',
      legs: v.legs,
      reversalId: mirror,
    });
    return { original, mirror };
  }

  /**
   *   V1  Bil POSTED    D1  cash 100 / sales 100
   *   V2  Jrl CANCELLED D1  x 50 / y 50          ↔ V3 Rev POSTED D1 (same-day pair)
   *   V4  Bil CANCELLED D1  cash 70 / sales 70   ↔ V5 Bil POSTED D2 (pair across days)
   *   V6  Con POSTED    D2  bank 30 / cash 30
   *   V7  ExpV DRAFT    D2  doc amount 40, no legs
   */
  async function scenario<T>(
    run: (tx: Prisma.TransactionClient, ids: Record<string, string>, p: Pipeline) => Promise<T>,
  ): Promise<void> {
    const pipeline = app.get<DaySummaryService, Pipeline>(DaySummaryService);
    try {
      await prisma.$transaction(
        async (tx) => {
          const ids: Record<string, string> = {};
          ids.V1 = await voucher(tx, {
            type: T.Bil,
            date: D1,
            status: 'POSTED',
            legs: [
              { ledger: cash, side: 'DR', amount: 100 },
              { ledger: sales, side: 'CR', amount: 100 },
            ],
          });
          const p1 = await cancelled(tx, {
            type: T.Jrl,
            date: D1,
            mirrorType: T.Rev,
            mirrorDate: D1,
            legs: [
              { ledger: x, side: 'DR', amount: 50 },
              { ledger: y, side: 'CR', amount: 50 },
            ],
          });
          ids.V2 = p1.original;
          ids.V3 = p1.mirror;
          const p2 = await cancelled(tx, {
            type: T.Bil,
            date: D1,
            mirrorType: T.Bil,
            mirrorDate: D2,
            legs: [
              { ledger: cash, side: 'DR', amount: 70 },
              { ledger: sales, side: 'CR', amount: 70 },
            ],
          });
          ids.V4 = p2.original;
          ids.V5 = p2.mirror;
          ids.V6 = await voucher(tx, {
            type: T.Con,
            date: D2,
            status: 'POSTED',
            legs: [
              { ledger: bank, side: 'DR', amount: 30 },
              { ledger: cash, side: 'CR', amount: 30 },
            ],
          });
          ids.V7 = await voucher(tx, {
            type: T.ExpV,
            date: D2,
            status: 'DRAFT',
            legs: [],
            docAmount: 40,
          });
          await run(tx, ids, pipeline);
          throw ROLLBACK;
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
    } catch (e) {
      if (e !== ROLLBACK) {
        throw e;
      }
    }
  }

  async function summaryOf(
    tx: Prisma.TransactionClient,
    p: Pipeline,
    q: Record<string, unknown>,
  ): Promise<SummaryPayload> {
    const scope = await p.resolveScope(tx, {
      companyId: COMPANY,
      accYear: ACC_YEAR,
      branchId: BRANCH,
      ...q,
    });
    return p.buildSummary(tx, scope, await p.loadBooks(tx, scope));
  }

  const row = (s: SummaryPayload, type: number): Partial<TypeRow> | undefined =>
    s.types.find((t) => t.voucherTypeId === type);
  const level = (s: SummaryPayload, code: string) => s.checks.find((c) => c.code === code);
  const moved = (s: SummaryPayload) =>
    signed(s.moneyTotals.CASH.closing).minus(signed(s.moneyTotals.CASH.opening)).toFixed(2);

  it('day D1: a sale, a same-day pair left out, a lone cancelled half counted (§11 items 2–4)', async () => {
    await scenario(async (tx, _ids, p) => {
      const s = await summaryOf(tx, p, { fromDate: D1 });
      expect(row(s, T.Bil)).toMatchObject({
        vouchers: 2,
        loneHalves: 1,
        cancelledPairs: 0,
        amount: '170.00',
        cashIn: '170.00',
        cashOut: '0.00',
      });
      expect(row(s, T.Jrl)).toMatchObject({ vouchers: 0, cancelledPairs: 1, amount: '0.00' });
      expect(row(s, T.Rev)).toBeUndefined();
      expect(level(s, 'BALANCED')?.level).toBe('OK');
      expect(level(s, 'AMOUNT_TIES')?.level).toBe('OK');
      expect(level(s, 'CANCELLED_PAIRS')?.facts).toEqual({ pairs: 1, loneHalves: 1 });
      expect(s.groupTotals).toEqual({ debit: '170.00', credit: '170.00' });
      expect(moved(s)).toBe('170.00');
    });
  });

  it('day D2: the lone mirror on its own Bil row, a contra, a draft (§11 items 4, 6, 7)', async () => {
    await scenario(async (tx, _ids, p) => {
      const s = await summaryOf(tx, p, { fromDate: D2 });
      expect(row(s, T.Bil)).toMatchObject({
        vouchers: 1,
        loneHalves: 1,
        amount: '70.00',
        cashOut: '70.00',
      });
      expect(row(s, T.Con)).toMatchObject({
        vouchers: 1,
        amount: '30.00',
        cashOut: '30.00',
        bankIn: '30.00',
      });
      expect(row(s, T.ExpV)).toMatchObject({ vouchers: 0, drafts: 1, amount: '0.00' });
      expect(level(s, 'DRAFTS')).toMatchObject({
        level: 'WARN',
        facts: { count: 1, amount: '40.00' },
      });
      expect(s.tiles.find((t) => t.code === 'EXPENSES')).toMatchObject({
        drafts: 1,
        amount: '0.00',
      });
      expect(moved(s)).toBe('-100.00');
    });
  });

  it('range D1–D2: the cross-day pair is left out too; the cash closing does not move (§4.4)', async () => {
    await scenario(async (tx, _ids, p) => {
      const s = await summaryOf(tx, p, { fromDate: D1, toDate: D2 });
      expect(row(s, T.Bil)).toMatchObject({
        vouchers: 1,
        loneHalves: 0,
        cancelledPairs: 1,
        amount: '100.00',
        cashIn: '100.00',
        cashOut: '0.00',
      });
      expect(row(s, T.Jrl)).toMatchObject({ cancelledPairs: 1 });
      expect(s.typeTotals).toMatchObject({
        vouchers: 2,
        cancelledPairs: 2,
        loneHalves: 0,
        amount: '130.00',
      });
      expect(moved(s)).toBe('70.00');
      expect(level(s, 'AMOUNT_TIES')?.level).toBe('OK');
    });
  });

  it('a voucherTypeId filter keeps the pair: Jrl shows it, Rev shows nothing (§11 item 9)', async () => {
    await scenario(async (tx, _ids, p) => {
      const jrl = await summaryOf(tx, p, { fromDate: D1, voucherTypeId: T.Jrl });
      expect(jrl.types.map((t) => [t.voucherTypeId, t.vouchers, t.cancelledPairs])).toEqual([
        [T.Jrl, 0, 1],
      ]);
      const rev = await summaryOf(tx, p, { fromDate: D1, voucherTypeId: T.Rev });
      expect(rev.types).toEqual([]);
      const bil = await summaryOf(tx, p, { fromDate: D1, toDate: D2, voucherTypeId: T.Bil });
      expect(bil.types).toEqual([row(await summaryOf(tx, p, { fromDate: D1, toDate: D2 }), T.Bil)]);
      expect(bil.moneyTotals.CASH).toMatchObject({
        opening: null,
        closing: null,
        in: '100.00',
        out: '0.00',
      });
    });
  });

  it('day-wise: each day its own day book; closings chain to the range closing (§11 item 10)', async () => {
    await scenario(async (tx, _ids, p) => {
      const scope = await p.resolveScope(tx, {
        companyId: COMPANY,
        accYear: ACC_YEAR,
        branchId: BRANCH,
        fromDate: D1,
        toDate: D2,
      });
      const daily = await p.buildDaily(tx, scope, await p.loadBooks(tx, scope));
      expect(
        daily.days.map((d) => [d.date, d.vouchers, d.cancelledPairs, d.drafts, d.amount]),
      ).toEqual([
        [D1, 2, 1, 0, '170.00'],
        [D2, 2, 0, 1, '100.00'],
      ]);
      expect(daily.days[1]).toMatchObject({ cashIn: '0.00', cashOut: '100.00', bankIn: '30.00' });
      const s = await summaryOf(tx, p, { fromDate: D1, toDate: D2 });
      expect(daily.days[1].cashClosing).toEqual(s.moneyTotals.CASH.closing);
    });
  });

  it('the Vouchers tab lists both halves of a pair, flagged, and hides them on request (§11 item 3)', async () => {
    await scenario(async (tx, ids, p) => {
      const q = {
        companyId: COMPANY,
        accYear: ACC_YEAR,
        branchId: BRANCH,
        fromDate: D1,
        toDate: D2,
      };
      const scope = await p.resolveScope(tx, q);
      const books = await p.loadBooks(tx, scope);
      const all = await p.buildVouchers(tx, scope, books, { ...q, withLegs: true });
      if (all.draftsOnly) {
        throw new Error('expected vouchers');
      }
      const kinds = Object.fromEntries(
        all.rows.map((r) => [r.voucherId, [r.rowKind, r.pairInRange]]),
      );
      expect(kinds).toEqual({
        [ids.V1]: ['NORMAL', false],
        [ids.V2]: ['CANCELLED', true],
        [ids.V3]: ['REVERSAL', true],
        [ids.V4]: ['CANCELLED', true],
        [ids.V5]: ['REVERSAL', true],
        [ids.V6]: ['NORMAL', false],
      });
      const contra = all.rows.find((r) => r.voucherId === ids.V6);
      expect(contra).toMatchObject({ amount: '30.00', legCount: 2, narration: 'ZT-DS synthetic' });
      expect(contra?.particulars).not.toBeNull();
      const without = await p.buildVouchers(tx, scope, books, {
        ...q,
        includeCancelledPairs: false,
      });
      expect(without.rows.map((r) => r.voucherId)).toEqual([ids.V1, ids.V6]);
      expect(without.totals.amount).toBe('130.00');
      const bankOnly = await p.buildVouchers(tx, scope, books, { ...q, moneyKind: 'BANK' });
      expect(bankOnly.rows.map((r) => r.voucherId)).toEqual([ids.V6]);
      const drafts = await p.buildVouchers(tx, scope, books, { ...q, draftsOnly: true });
      expect(drafts).toMatchObject({ draftsOnly: true, totals: { amount: '40.00' } });
      expect(drafts.rows.map((r) => r.voucherId)).toEqual([ids.V7]);
    });
  });
});
