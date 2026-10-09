import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';

import { as, bootIdentityApp, TESTER } from './helpers/identity-app';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from './helpers/menu-rights';
import { COMPANY, data, expectStatus, prisma } from './helpers/payment-e2e';
import { istToday } from '../src/modules/reports/party-outstanding/party-outstanding.ageing';
import type {
  Bal,
  BillHistoryPayload,
  BillsPayload,
  BillWisePayload,
  DueCalendarPayload,
  OptionsPayload,
  PartiesPayload,
  PartyCardPayload,
  PartiesExportPayload,
  StatementExportPayload,
  SummaryPayload,
} from '../src/modules/reports/party-outstanding/types/party-outstanding.types';

/**
 * Party-wise Outstanding — Prathap/report/plan-backend-party-outstanding.md,
 * over HTTP against the dev database (the real guard, validation pipe and
 * filters). READ-ONLY apart from the user_menus fixture: tester1 is granted
 * menu 279 before the first request and put back after the last.
 *
 * The figures are not hard-coded — the box's rows are test data. Every check
 * reconciles the report with itself (§9.1, §9.4, paging), with the cached
 * columns (§9.3) or with a brute-force SQL of §4.3 over every bill (the
 * candidate set and the chain rule cannot drop or add one).
 *
 *     npm run test:e2e -- party-outstanding-http --runInBand
 */

jest.setTimeout(300_000);

const MENU = 279;
const BASE = '/api/v1/reports/party-outstanding';
const TODAY = istToday();
const SIDES = ['RECEIVABLE', 'PAYABLE'] as const;
const OWED = { RECEIVABLE: 'DR', PAYABLE: 'CR' } as const;

let app: INestApplication;
let rights: MenuRightsMemo | null = null;
let branches: string[] = [];

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

/** A balance as a signed decimal toward the owed side. */
const signed = (b: Bal, owedSide: string): Prisma.Decimal =>
  b.side === null
    ? new Prisma.Decimal(0)
    : new Prisma.Decimal(b.amount).times(b.side === owedSide ? 1 : -1);

async function allParties(query: Record<string, unknown>): Promise<PartiesPayload> {
  return ok<PartiesPayload>('parties', { ...query, pageSize: 500 });
}

async function allBills(query: Record<string, unknown>): Promise<BillWisePayload['rows']> {
  let rows: BillWisePayload['rows'] = [];
  for (let page = 1; ; page += 1) {
    const bw = await ok<BillWisePayload>('bill-wise', { ...query, pageSize: 500, page });
    rows = rows.concat(bw.rows);
    if (rows.length >= bw.page.totalRows || bw.rows.length === 0) {
      return rows;
    }
  }
}

beforeAll(async () => {
  app = await bootIdentityApp();
  rights = await grantMenuRights(prisma, [MENU]);
  branches = (
    await prisma.$queryRaw<{ br: string }[]>`
      SELECT DISTINCT abl_branch_id AS br FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${COMPANY}::uuid AND abl_branch_id IS NOT NULL`
  ).map((r) => r.br);
});

afterAll(async () => {
  await restoreMenuRights(prisma, rights);
  await app?.close();
  await prisma.$disconnect();
});

describe('guards and refusals (§8)', () => {
  const q = { companyId: COMPANY, asOn: TODAY, side: 'RECEIVABLE' };

  it('403 NO_MENU_RIGHT without view on menu 279', async () => {
    const [held] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM public.user_menus
       WHERE um_user_id = ${TESTER}::uuid AND um_menu_id = ${MENU} AND um_can_view AND NOT um_is_deleted`;
    if (Number(held.n) > 0) {
      return; // someone granted 'tester' the report on this box
    }
    const res = await get('parties', q, as('tester', ''));
    expectStatus(res, 403);
    expect(JSON.stringify(res.body)).toContain('NO_MENU_RIGHT');
  });

  it('400 on a malformed key; accYear is not an input (§4.1)', async () => {
    expectStatus(await get('parties', { ...q, side: 'BOTH' }), 400);
    expectStatus(await get('parties', { ...q, asOn: '09-10-2026' }), 400);
    expectStatus(await get('parties', { ...q, accYear: '2026-2027' }), 400);
    expectStatus(await get('parties', { ...q, pageSize: 501 }), 400);
  });

  it('422 with the plan’s codes', async () => {
    await refused('parties', { ...q, buckets: '30,20' }, 422, 'BAD_BUCKETS');
    await refused('parties', { ...q, buckets: '30,60,4000' }, 422, 'BAD_BUCKETS');
    await refused('parties', { ...q, asOn: '2001-01-01' }, 422, 'AS_ON_OUTSIDE_YEARS');
    await refused('parties', { ...q, asOn: '2026-02-30' }, 422, 'AS_ON_OUTSIDE_YEARS');
    await refused('parties', { ...q, side: 'PAYABLE', areaId: COMPANY }, 422, 'NOT_FOR_PAYABLE');
    await refused(
      'parties',
      { ...q, side: 'PAYABLE', collectionDay: 'MON' },
      422,
      'NOT_FOR_PAYABLE',
    );
    await refused(
      'summary',
      { ...q, side: 'PAYABLE', groupBy: 'SALESMAN' },
      422,
      'NOT_FOR_PAYABLE',
    );
    await refused('parties', { ...q, branchId: COMPANY }, 422, 'BRANCH_NOT_IN_COMPANY');
    await refused('bills', { ...q, partyId: COMPANY }, 422, 'PARTY_NOT_IN_COMPANY');
    await refused('parties', { ...q, sort: 'bucket6' }, 422, 'BAD_SORT');
    await refused('export', { ...q, shape: 'PARTIES', sort: 'refno' }, 422, 'BAD_SORT');
    await refused('export', { ...q, shape: 'PARTY_STATEMENT' }, 422, 'PARTY_REQUIRED');
    await refused(
      'due-calendar',
      { ...q, from: '2026-10-01', to: '2027-01-05' },
      422,
      'RANGE_TOO_LARGE',
    );
    await refused(
      'due-calendar',
      { ...q, from: '2026-10-10', to: '2026-10-01' },
      422,
      'RANGE_REVERSED',
    );
  });
});

describe('/options (§5.1)', () => {
  it('Receivable: Sundry Debtors first and default, sub-groups deeper; areas carry weekdays', async () => {
    const o = await ok<OptionsPayload>('options', { companyId: COMPANY, side: 'RECEIVABLE' });
    expect(o.groups[0]).toMatchObject({ name: 'Sundry Debtors', depth: 0, isDefault: true });
    expect(o.groups.filter((g) => g.isDefault)).toHaveLength(1);
    expect(o.groups.slice(1).every((g) => g.depth > 0)).toBe(true);
    for (const a of o.areas) {
      expect(
        a.collectionDays.every((d) =>
          ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(d),
        ),
      ).toBe(true);
    }
  });

  it('Payable: Sundry Creditors, no areas and no salesmen', async () => {
    const o = await ok<OptionsPayload>('options', { companyId: COMPANY, side: 'PAYABLE' });
    expect(o.groups[0]).toMatchObject({ name: 'Sundry Creditors', isDefault: true });
    expect(o.areas).toEqual([]);
    expect(o.salesmen).toEqual([]);
  });
});

describe.each(SIDES)('%s — the numbers agree (§9)', (side) => {
  const owed = OWED[side];
  const q = { companyId: COMPANY, asOn: TODAY, side };

  it('every row has one bucket per label, by bill date and by due date', async () => {
    for (const ageBy of ['BILL_DATE', 'DUE_DATE']) {
      const p = await allParties({ ...q, ageBy, buckets: '15,45,90' });
      expect(p.bucketLabels).toHaveLength(ageBy === 'DUE_DATE' ? 5 : 4);
      expect(p.totals.buckets).toHaveLength(p.bucketLabels.length);
      for (const r of p.rows) {
        expect(r.buckets).toHaveLength(p.bucketLabels.length);
        // Σ buckets = owed: every owed bill sits in exactly one bucket
        const sum = r.buckets.reduce((s, b) => s.plus(b), new Prisma.Decimal(0));
        expect(sum.toFixed(2)).toBe(r.owed);
      }
    }
  });

  it('§9.1 — Σ /bills net per party = the party’s row net; /party agrees too', async () => {
    const p = await allParties(q);
    expect(p.rows.length).toBe(Math.min(p.page.totalRows, 500));
    for (const r of p.rows) {
      const b = await ok<BillsPayload>('bills', { ...q, partyId: r.partyId });
      expect({ party: r.name, net: b.totals.net }).toEqual({ party: r.name, net: r.net });
      expect(b.totals.bills).toBe(b.rows.length);
    }
    const first = p.rows[0];
    if (first) {
      const card = await ok<PartyCardPayload>('party', { ...q, partyId: first.partyId });
      expect(card.net).toEqual(first.net);
      expect(card.owed).toBe(first.owed);
      expect(card.ageing.amounts).toEqual(first.buckets);
    }
  });

  it('totals = Σ rows; tiles = totals; bill-wise covers the same bills', async () => {
    const p = await allParties(q);
    const sum = p.rows.reduce((s, r) => s.plus(signed(r.net, owed)), new Prisma.Decimal(0));
    expect(sum.toFixed(2)).toBe(signed(p.totals.net, owed).toFixed(2));
    expect(p.tiles.net).toEqual(p.totals.net);
    expect(p.tiles.bills).toBe(p.totals.bills);
    expect(p.tiles.parties).toBe(p.page.totalRows);
    const bw = await ok<BillWisePayload>('bill-wise', { ...q, pageSize: 1 });
    expect(bw.totals.net).toEqual(p.totals.net);
  });

  it('§9.4 — all branches = Σ each branch', async () => {
    const all = await ok<PartiesPayload>('parties', { ...q, pageSize: 1 });
    let sum = new Prisma.Decimal(0);
    for (const branchId of branches) {
      const one = await ok<PartiesPayload>('parties', { ...q, branchId, pageSize: 1 });
      sum = sum.plus(signed(one.totals.net, owed));
    }
    expect(sum.toFixed(2)).toBe(signed(all.totals.net, owed).toFixed(2));
  });

  it('paging: totals the same on every page, order stable across pages', async () => {
    const all = await allParties(q);
    const ids: string[] = [];
    for (let page = 1; page <= Math.ceil(all.page.totalRows / 9) + 1; page += 1) {
      const pg = await ok<PartiesPayload>('parties', { ...q, pageSize: 9, page });
      expect(pg.totals).toEqual(all.totals);
      ids.push(...pg.rows.map((r) => r.partyId));
    }
    expect(ids).toEqual(all.rows.map((r) => r.partyId));
    for (const sort of ['name', 'oldest', 'bucket0', 'owed']) {
      const a = await ok<PartiesPayload>('parties', { ...q, sort, dir: 'asc', pageSize: 500 });
      expect(a.rows).toHaveLength(all.rows.length);
    }
  });

  it('§9.3 — D = today: each bill’s pending = abl_pending_amount (bills with a row dated after today aside)', async () => {
    const rows = await allBills(q);
    const cached = await prisma.$queryRaw<
      { id: string; yr: string; p: Prisma.Decimal; fut: boolean }[]
    >`
      SELECT b.abl_id AS id, b.abl_acc_year AS yr, b.abl_pending_amount AS p,
             EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment a
                      WHERE a.abj_bill_id = b.abl_id AND a.abj_bill_acc_year = b.abl_acc_year
                        AND NOT a.abj_is_deleted AND a.abj_adj_date > ${TODAY}::date) AS fut
        FROM accounts.acc_bill_balance b
       WHERE b.abl_company_id = ${COMPANY}::uuid AND NOT b.abl_is_deleted`;
    const byId = new Map(cached.map((c) => [`${c.id}|${c.yr.trim()}`, c]));
    for (const r of rows) {
      const c = byId.get(`${r.billId}|${r.accYear}`);
      expect(c).toBeDefined();
      if (c && !c.fut) {
        expect({ bill: r.docRefno, pending: r.pending }).toEqual({
          bill: r.docRefno,
          pending: new Prisma.Decimal(c.p).toFixed(2),
        });
      }
    }
  });

  it('the as-on figures match a brute-force §4.3 over every bill at past dates', async () => {
    const [range] = await prisma.$queryRaw<{ lo: Date | null; hi: Date | null }[]>`
      SELECT MIN(abl_doc_date) AS lo, MAX(abl_doc_date) AS hi FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${COMPANY}::uuid AND NOT abl_is_deleted AND abl_doc_date <= ${TODAY}::date`;
    if (!range.lo || !range.hi) {
      return;
    }
    const lo = range.lo.getTime();
    const hi = range.hi.getTime();
    const dates = [0.25, 0.5, 0.9].map((f) =>
      new Date(lo + (hi - lo) * f).toISOString().slice(0, 10),
    );
    for (const asOn of dates) {
      const brute = await prisma.$queryRaw<{ id: string; dr_cr: string; p: Prisma.Decimal }[]>`
        SELECT b.abl_id AS id, btrim(b.abl_dr_cr) AS dr_cr,
               b.abl_bill_amount
               - COALESCE((SELECT SUM(a.abj_amount) FROM accounts.acc_bill_adjustment a
                            WHERE a.abj_bill_id = b.abl_id AND a.abj_bill_acc_year = b.abl_acc_year
                              AND NOT a.abj_is_deleted AND a.abj_adj_date <= ${asOn}::date), 0)
               - GREATEST(b.abl_alloc_amount + b.abl_disc_amount + b.abl_writeoff_amount
                          - COALESCE((SELECT SUM(a.abj_amount) FROM accounts.acc_bill_adjustment a
                                       WHERE a.abj_bill_id = b.abl_id
                                         AND a.abj_bill_acc_year = b.abl_acc_year
                                         AND NOT a.abj_is_deleted
                                         AND NOT (COALESCE(a.abj_is_post_dated, false)
                                                  AND a.abj_adj_date > ${TODAY}::date)), 0), 0) AS p
          FROM accounts.acc_bill_balance b
         WHERE b.abl_company_id = ${COMPANY}::uuid AND NOT b.abl_is_deleted
           AND b.abl_doc_date <= ${asOn}::date
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_balance ch
                            WHERE ch.abl_parent_bill_id = b.abl_id
                              AND ch.abl_parent_acc_year = b.abl_acc_year
                              AND ch.abl_bill_type = 'OPENING' AND NOT ch.abl_is_deleted)`;
      const want = new Map(
        brute
          .filter((r) => !new Prisma.Decimal(r.p).isZero())
          .map((r) => [r.id, new Prisma.Decimal(r.p).toFixed(2)]),
      );
      const got = new Map((await allBills({ ...q, asOn })).map((r) => [r.billId, r.pending]));
      // Every bill the report lists is pending by brute force, with the same amount …
      for (const [id, pending] of got) {
        expect({ asOn, id, pending: want.get(id) }).toEqual({ asOn, id, pending });
      }
      // … and every bill pending by brute force on this side's party scope is listed.
      const scoped = await ok<PartiesExportPayload>('export', {
        ...q,
        asOn,
        hideZero: false,
        shape: 'PARTIES',
      });
      const inScope = new Set(scoped.rows.map((r) => r.partyId));
      const partyOf = new Map(
        (
          await prisma.$queryRaw<{ id: string; party: string }[]>`
            SELECT abl_id AS id, abl_party_id AS party FROM accounts.acc_bill_balance
             WHERE abl_company_id = ${COMPANY}::uuid`
        ).map((r) => [r.id, r.party]),
      );
      for (const id of want.keys()) {
        if (inScope.has(partyOf.get(id) as string)) {
          expect({ asOn, id, listed: got.has(id) }).toEqual({ asOn, id, listed: true });
        }
      }
    }
  });
});

describe('post-dated cheques (§4.5, §12 case 4)', () => {
  it('a row dated after today settles on its date, and is PDC in hand until then', async () => {
    const [pdc] = await prisma.$queryRaw<
      { bill: string; party: string; d: Date; amt: Prisma.Decimal; tra: string }[]
    >`
      SELECT a.abj_bill_id AS bill, a.abj_party_id AS party, a.abj_adj_date AS d,
             SUM(a.abj_amount) AS amt, MIN(r.apd_tra_type) AS tra
        FROM accounts.acc_bill_adjustment a
        JOIN accounts.acc_pdc_register r
          ON r.apd_id = a.abj_cheque_id AND r.apd_acc_year = a.abj_cheque_acc_year
       WHERE a.abj_company_id = ${COMPANY}::uuid AND NOT a.abj_is_deleted AND a.abj_is_post_dated
         AND a.abj_adj_date > ${TODAY}::date
         AND r.apd_status IN ('HELD', 'DEPOSITED') AND r.apd_received_on <= ${TODAY}::date
       GROUP BY 1, 2, 3
       LIMIT 1`;
    if (!pdc) {
      return; // no post-dated cheque ahead of today on this box
    }
    const side = pdc.tra === 'P' ? 'PAYABLE' : 'RECEIVABLE';
    const due = pdc.d.toISOString().slice(0, 10);
    const dayBefore = new Date(pdc.d.getTime() - 86_400_000).toISOString().slice(0, 10);
    const pendingOn = async (asOn: string) =>
      (
        await ok<BillsPayload>('bills', { companyId: COMPANY, asOn, side, partyId: pdc.party })
      ).rows.find((r) => r.billId === pdc.bill)?.pending ?? '0.00';
    const drop = new Prisma.Decimal(await pendingOn(dayBefore)).minus(await pendingOn(due));
    expect(drop.toFixed(2)).toBe(new Prisma.Decimal(pdc.amt).toFixed(2));

    const before = await ok<PartyCardPayload>('party', {
      companyId: COMPANY,
      asOn: dayBefore,
      side,
      partyId: pdc.party,
    });
    const on = await ok<PartyCardPayload>('party', {
      companyId: COMPANY,
      asOn: due,
      side,
      partyId: pdc.party,
    });
    expect(before.pdcInHand.some((c) => c.chequeDate === due)).toBe(true);
    expect(on.pdcInHand.some((c) => c.chequeDate === due)).toBe(false);
    expect(on.pdcEffectiveUncleared.some((c) => c.chequeDate === due)).toBe(true);
    expect(on.isFuture).toBe(due > TODAY);

    // deductPdc takes the in-hand cheques off net, and nothing else
    const plain = await ok<PartiesPayload>('parties', {
      companyId: COMPANY,
      asOn: dayBefore,
      side,
      partyId: pdc.party,
    });
    const less = await ok<PartiesPayload>('parties', {
      companyId: COMPANY,
      asOn: dayBefore,
      side,
      partyId: pdc.party,
      deductPdc: true,
    });
    const owedSide = OWED[side];
    expect(
      signed(plain.rows[0].net, owedSide).minus(signed(less.rows[0].net, owedSide)).toFixed(2),
    ).toBe(plain.rows[0].pdcInHand);
  });
});

describe('counter tender with no row (§3.1, §12 case 8)', () => {
  it('pending = bill − tender on the bill date; bill-history shows it as tenderAtBill', async () => {
    const [t] = await prisma.$queryRaw<
      {
        id: string;
        yr: string;
        party: string;
        d: Date;
        bill: Prisma.Decimal;
        tender: Prisma.Decimal;
      }[]
    >`
      WITH r AS (SELECT abj_bill_id, abj_bill_acc_year, SUM(abj_amount) AS s
                   FROM accounts.acc_bill_adjustment WHERE NOT abj_is_deleted GROUP BY 1, 2)
      SELECT b.abl_id AS id, b.abl_acc_year AS yr, b.abl_party_id AS party, b.abl_doc_date AS d,
             b.abl_bill_amount AS bill,
             b.abl_alloc_amount + b.abl_disc_amount + b.abl_writeoff_amount - COALESCE(r.s, 0) AS tender
        FROM accounts.acc_bill_balance b
        LEFT JOIN r ON r.abj_bill_id = b.abl_id AND r.abj_bill_acc_year = b.abl_acc_year
       WHERE b.abl_company_id = ${COMPANY}::uuid AND NOT b.abl_is_deleted
         AND b.abl_src_doc_type = 'SALE_BILL' AND b.abl_pending_amount <> 0
         AND b.abl_alloc_amount + b.abl_disc_amount + b.abl_writeoff_amount - COALESCE(r.s, 0) > 0
       LIMIT 1`;
    if (!t) {
      return;
    }
    const asOn = t.d.toISOString().slice(0, 10);
    const bills = await ok<BillsPayload>('bills', {
      companyId: COMPANY,
      asOn,
      side: 'RECEIVABLE',
      partyId: t.party,
    });
    const row = bills.rows.find((r) => r.billId === t.id);
    expect(row?.tenderDerived).toBe(true);
    expect(row?.pending).toBe(new Prisma.Decimal(t.bill).minus(t.tender).toFixed(2));
    const h = await ok<BillHistoryPayload>('bill-history', {
      companyId: COMPANY,
      billId: t.id,
      accYear: t.yr.trim(),
      asOn,
    });
    expect(h.tenderAtBill).toBe(new Prisma.Decimal(t.tender).toFixed(2));
    expect(h.bill.pending).toBe(row?.pending);
  });
});

describe('the other tabs agree with the grid', () => {
  const q = { companyId: COMPANY, asOn: TODAY, side: 'RECEIVABLE' };

  it('/summary totals = /parties totals for every groupBy; BRANCH rows sum to them', async () => {
    const p = await ok<PartiesPayload>('parties', { ...q, pageSize: 1 });
    for (const groupBy of ['AREA', 'GROUP', 'SALESMAN', 'BRANCH']) {
      const s = await ok<SummaryPayload>('summary', { ...q, groupBy });
      expect(s.totals.net).toEqual(p.totals.net);
      expect(s.totals.parties).toBe(p.page.totalRows);
      const sum = s.rows.reduce((acc, r) => acc.plus(signed(r.net, 'DR')), new Prisma.Decimal(0));
      expect(sum.toFixed(2)).toBe(signed(p.totals.net, 'DR').toFixed(2));
    }
  });

  it('a due-calendar day = /bill-wise with dueOn that day', async () => {
    const to = new Date(Date.parse(`${TODAY}T00:00:00Z`) + 60 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const cal = await ok<DueCalendarPayload>('due-calendar', { ...q, from: TODAY, to });
    for (const day of cal.days.slice(0, 5)) {
      const bw = await ok<BillWisePayload>('bill-wise', { ...q, dueOn: day.date, pageSize: 500 });
      expect(bw.page.totalRows).toBe(day.bills);
      const sum = bw.rows.reduce((s, r) => s.plus(r.pending), new Prisma.Decimal(0));
      expect(sum.toFixed(2)).toBe(day.amount);
    }
  });

  it('/export PARTIES = /parties unpaged; PARTY_STATEMENT = the card and the bills', async () => {
    const p = await allParties(q);
    const ex = await ok<PartiesExportPayload>('export', { ...q, shape: 'PARTIES' });
    expect(ex.totalRows).toBe(p.page.totalRows);
    expect(ex.totals).toEqual(p.totals);
    expect(ex.printedAs).toContain('Receivable outstanding as on');
    const first = p.rows[0];
    if (first) {
      const st = await ok<StatementExportPayload>('export', {
        ...q,
        shape: 'PARTY_STATEMENT',
        partyId: first.partyId,
      });
      const bills = await ok<BillsPayload>('bills', { ...q, partyId: first.partyId });
      expect(st.net).toEqual(first.net);
      expect(st.rows.map((r) => r.billId)).toEqual(bills.rows.map((r) => r.billId));
      expect(st.party.partyId).toBe(first.partyId);
    }
  });

  it('onlyOverdue keeps parties with overdue, and only overdue owed bills in /bills', async () => {
    const p = await allParties({ ...q, onlyOverdue: true });
    expect(p.rows.every((r) => new Prisma.Decimal(r.overdue).greaterThan(0))).toBe(true);
    const first = p.rows[0];
    if (first) {
      const b = await ok<BillsPayload>('bills', {
        ...q,
        partyId: first.partyId,
        onlyOverdue: true,
      });
      expect(b.rows.every((r) => r.side === 'OWED' && (r.overdueDays ?? 0) > 0)).toBe(true);
      const sum = b.rows.reduce((s, r) => s.plus(r.pending), new Prisma.Decimal(0));
      expect(sum.toFixed(2)).toBe(first.overdue);
    }
  });

  it('includeOnAccount=false drops every on-account figure', async () => {
    const p = await allParties({ ...q, includeOnAccount: false });
    expect(p.totals.onAccount).toBe('0.00');
    expect(p.rows.every((r) => r.onAccount === '0.00' && !r.flags.includes('ADVANCE'))).toBe(true);
  });
});
