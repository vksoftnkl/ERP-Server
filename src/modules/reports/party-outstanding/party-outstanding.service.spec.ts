import { HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  OutstandingBillHistoryDto,
  OutstandingBillWiseDto,
  OutstandingDueCalendarDto,
  OutstandingExportDto,
  OutstandingOptionsDto,
  OutstandingPartiesDto,
  OutstandingPartyDto,
  OutstandingSummaryDto,
} from './dto/party-outstanding-query.dto';
import { PARTY_OUTSTANDING_MENU_ID, PartyOutstandingService } from './party-outstanding.service';
import { SUNDRY_CREDITORS_GROUP_ID, SUNDRY_DEBTORS_GROUP_ID } from './party-outstanding.sql';
import { PARTY_OUTSTANDING_ERROR } from './types/party-outstanding.types';

const COMPANY = '019c6f6c-be87-7a11-8905-36092c46b001';
const BRANCH = '019c6f6c-be87-7a11-8905-36092c46b002';
const PARTY = '019c6f6c-be87-7a11-8905-36092c46b003';
const USER = '019c6f6c-be87-7a11-8905-36092c46b004';
const GROUP = '019c6f6c-be87-7a11-8905-36092c46b005';
const BILL = '019c6f6c-be87-7a11-8905-36092c46b006';
const BILL_2 = '019c6f6c-be87-7a11-8905-36092c46b007';
const VOUCHER = '019c6f6c-be87-7a11-8905-36092c46b008';
const AREA = '019c6f6c-be87-7a11-8905-36092c46b009';
const SALESMAN = '019c6f6c-be87-7a11-8905-36092c46b00a';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
/** 2026-10-21 11:30 IST — the IST business date is 2026-10-21. */
const NOW = new Date('2026-10-21T06:00:00.000Z');
const AS_ON = '2026-10-09';

const dec = (v: number | string) => new Prisma.Decimal(v);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// ── a fake $queryRaw that routes each statement by a fragment of its SQL ────

type Answer = unknown[] | ((sql: Prisma.Sql) => unknown[]);
interface Call {
  key: string;
  text: string;
  values: unknown[];
}

/** First match wins, so the big statements (which embed the CTEs) come first. */
const ROUTES: [string, string][] = [
  ["SELECT 'D' AS kind", 'calendar'],
  ['sg AS (', 'summaryParty'],
  ['sb AS (', 'summaryBranch'],
  ['pf.*, ROW_NUMBER()', 'parties'],
  ['pt.name AS party_name', 'bills'],
  ['FROM o WHERE NOT is_owed', 'onAccount'],
  ['last AS (SELECT vid', 'lastSettlement'],
  ['a.abj_row_no AS row_no', 'remarks'],
  ['r.apd_instrument_no AS cheque_no', 'historyRows'],
  ['WHERE abl_id = ', 'historyBill'],
  ['accounts.acc_opening_balance', 'ledgerClosing'],
  ['r.apd_bank_name', 'pdcs'],
  ['l.led_gstin_no', 'facts'],
  ['public.companys', 'names'],
  ['FROM public.user_menus', 'menu'],
  ['FROM public.fiscal_years', 'fy'],
  ['SELECT br_comp_id FROM public.branch_master', 'branch'],
  ['SELECT EXISTS (SELECT 1 FROM accounts.acc_ledger_master', 'partyCheck'],
  ['lower(btrim(acc_group_name))', 'root'],
  ['SELECT id, name, depth FROM t', 'groups'],
  ['FROM sales.area_master WHERE arm_is_deleted', 'areas'],
  ['FROM public.employee_master e', 'salesmen'],
  ['SELECT br_id, br_name FROM public.branch_master', 'branches'],
];

const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

function makeDb() {
  const calls: Call[] = [];
  const answers = new Map<string, Answer>();
  const $queryRaw = jest.fn(async (first: unknown, ...values: unknown[]) => {
    const sql =
      Array.isArray(first) && 'raw' in first
        ? Prisma.sql(first as unknown as TemplateStringsArray, ...values)
        : (first as Prisma.Sql);
    const text = flat(sql.text);
    const route = ROUTES.find(([marker]) => text.includes(marker));
    if (!route) {
      throw new Error(`unrouted SQL: ${text.slice(0, 160)}`);
    }
    calls.push({ key: route[1], text, values: sql.values });
    const answer = answers.get(route[1]) ?? [];
    return typeof answer === 'function' ? answer(sql) : answer;
  });
  return {
    prisma: { $queryRaw } as unknown as PrismaService,
    $queryRaw,
    calls,
    answer: (key: string, rows: Answer) => answers.set(key, rows),
    /** Every call routed to `key`, in order. */
    of: (key: string) => calls.filter((c) => c.key === key),
    /** The one call routed to `key`. */
    one: (key: string) => {
      const hits = calls.filter((c) => c.key === key);
      if (hits.length !== 1) throw new Error(`${hits.length} calls to ${key}`);
      return hits[0];
    },
  };
}

/** The `tot` row the party statements always return, even past the last page. */
const totRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  party_id: null,
  t_parties: 0n,
  t_bills: 0n,
  t_owed: dec(0),
  t_on_account: dec(0),
  t_net: dec(0),
  t_b0: dec(0),
  t_b1: dec(0),
  t_b2: dec(0),
  t_b3: dec(0),
  t_b4: dec(0),
  t_b5: dec(0),
  t_overdue: dec(0),
  t_pdc_amt: dec(0),
  t_pdc_n: 0n,
  t_above_amt: dec(0),
  t_above_parties: 0n,
  t_due_next: dec(0),
  ...overrides,
});

/** One `pf` row of the page, joined to the totals. */
const partyRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...totRow({ t_parties: 1n }),
  party_id: PARTY,
  name: 'Ravi Stores',
  area_name: 'North',
  phone: '98400 00000',
  credit_days: 30,
  credit_limit: null,
  bills: 2n,
  owed: dec('1500.5'),
  on_account: dec(200),
  b0: dec('1000.5'),
  b1: dec(0),
  b2: dec(500),
  b3: dec(0),
  b4: dec(0),
  overdue: dec(500),
  oldest: 75,
  pdc_amt: dec(0),
  net: dec('1300.5'),
  bounced: false,
  ...overrides,
});

const billTot = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  abl_id: null,
  t_bills: 0n,
  t_bill_amount: dec(0),
  t_pending: dec(0),
  t_net: dec(0),
  ...overrides,
});

const billDbRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...billTot({ t_bills: 1n, t_bill_amount: dec(1000), t_pending: dec(600), t_net: dec(600) }),
  abl_id: BILL,
  abl_acc_year: '2026-2027',
  party_id: PARTY,
  party_name: 'Ravi Stores',
  area_name: 'North',
  br_name: 'Main',
  abl_bill_type: 'SALE',
  abl_src_doc_type: 'SALE_BILL',
  abl_src_doc_id: 'sb-1',
  abl_src_acc_year: '2026-2027',
  abl_voucher_id: VOUCHER,
  doc_refno: 'SB/001',
  abl_doc_date: day('2026-09-01'),
  abl_due_date: null,
  due_eff: day('2026-10-01'),
  bill_amount: dec(1000),
  pending: dec(600),
  gap: dec(0),
  is_owed: true,
  age_days: 38,
  overdue_days: 8,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

const codeOf = (refusal: { body: unknown }) =>
  (refusal.body as { errors: { code: string }[] }).errors[0].code;

// DTOs as the ValidationPipe hands them over.
const filter = { companyId: COMPANY, side: 'RECEIVABLE', asOn: AS_ON };
const partiesQ = (o: object = {}) => plainToInstance(OutstandingPartiesDto, { ...filter, ...o });
const partyQ = (o: object = {}) =>
  plainToInstance(OutstandingPartyDto, { ...filter, partyId: PARTY, ...o });
const billWiseQ = (o: object = {}) => plainToInstance(OutstandingBillWiseDto, { ...filter, ...o });
const summaryQ = (o: object = {}) =>
  plainToInstance(OutstandingSummaryDto, { ...filter, groupBy: 'GROUP', ...o });
const calendarQ = (o: object = {}) =>
  plainToInstance(OutstandingDueCalendarDto, {
    ...filter,
    from: '2026-10-10',
    to: '2026-10-31',
    ...o,
  });
const exportQ = (o: object = {}) =>
  plainToInstance(OutstandingExportDto, { ...filter, shape: 'PARTIES', ...o });
const historyQ = (o: object = {}) =>
  plainToInstance(OutstandingBillHistoryDto, {
    companyId: COMPANY,
    billId: BILL,
    accYear: '2026-2027',
    asOn: AS_ON,
    ...o,
  });

describe('PartyOutstandingService', () => {
  let db: ReturnType<typeof makeDb>;
  let context: { getUserId: jest.Mock };
  let service: PartyOutstandingService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    db = makeDb();
    db.answer('menu', [{ ok: true }]);
    db.answer('fy', [{ name: '2026-2027' }]);
    db.answer('branch', [{ br_comp_id: COMPANY }]);
    db.answer('partyCheck', [{ ok: true }]);
    db.answer('root', [{ id: SUNDRY_DEBTORS_GROUP_ID }]);
    db.answer('parties', [totRow()]);
    db.answer('bills', [billTot()]);
    db.answer('ledgerClosing', [{ bal: dec(0) }]);
    context = { getUserId: jest.fn().mockReturnValue(USER) };
    service = new PartyOutstandingService(db.prisma, context as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ── the menu right, on every route ────────────────────────────────────────
  describe('menu 279', () => {
    const routes: [string, () => Promise<unknown>][] = [
      ['options', () => service.options(plainToInstance(OutstandingOptionsDto, filter))],
      ['parties', () => service.parties(partiesQ())],
      ['party', () => service.party(partyQ())],
      ['bills', () => service.bills(partyQ())],
      ['billWise', () => service.billWise(billWiseQ())],
      ['billHistory', () => service.billHistory(historyQ())],
      ['summary', () => service.summary(summaryQ())],
      ['dueCalendar', () => service.dueCalendar(calendarQ())],
      ['export', () => service.export(exportQ())],
    ];

    it.each(routes)('%s asks for the view right on menu 279 as the caller', async (_name, call) => {
      await call().catch(() => undefined);

      expect(db.calls[0]).toMatchObject({ key: 'menu', values: [USER, PARTY_OUTSTANDING_MENU_ID] });
      expect(db.calls[0].text).toContain('um_can_view = true AND um_is_deleted = false');
    });

    it.each(routes)('%s refuses a caller without the right, and reads nothing else', async (_name, call) => {
      db.answer('menu', []);

      const refusal = await refusalOf(call());

      expect(refusal).toEqual({
        status: 403,
        body: {
          success: false,
          message: 'No access to Party-wise Outstanding',
          errors: [
            {
              field: 'menu',
              code: PARTY_OUTSTANDING_ERROR.NO_MENU_RIGHT,
              message: `This user may not view menu ${PARTY_OUTSTANDING_MENU_ID} (Reports › Party Outstanding).`,
            },
          ],
        },
      });
      expect(db.calls.map((c) => c.key)).toEqual(['menu']);
    });

    it.each([
      ['no logged-in caller', null],
      ['a caller id that is not a uuid', 'admin'],
    ])('refuses %s without asking the database', async (_label, userId) => {
      context.getUserId.mockReturnValue(userId);

      const refusal = await refusalOf(service.parties(partiesQ()));

      expect(refusal.status).toBe(403);
      expect(db.calls).toEqual([]);
    });
  });

  // ── the scope: refusals, in their order ───────────────────────────────────
  describe('the scope', () => {
    it.each([
      ['areaId', { areaId: AREA }],
      ['salesmanId', { salesmanId: SALESMAN }],
      ['collectionDay', { collectionDay: 'MON' }],
    ])('refuses %s on Payable, before anything is read', async (field, extra) => {
      const refusal = await refusalOf(service.parties(partiesQ({ side: 'PAYABLE', ...extra })));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'Party-wise outstanding request refused',
          errors: [
            {
              field,
              code: PARTY_OUTSTANDING_ERROR.NOT_FOR_PAYABLE,
              message: 'Area, salesman and collection day apply to customers only.',
            },
          ],
        },
      });
      expect(db.calls.map((c) => c.key)).toEqual(['menu']);
    });

    it('names the area first when a Payable request sends all three', async () => {
      const refusal = await refusalOf(
        service.parties(
          partiesQ({ side: 'PAYABLE', areaId: AREA, salesmanId: SALESMAN, collectionDay: 'MON' }),
        ),
      );

      expect(refusal).toMatchObject({ body: { errors: [{ field: 'areaId' }] } });
    });

    it('lets one Payable party be read with the grid filters still on the query', async () => {
      db.answer('parties', [partyRow()]);

      await expect(
        service.party(partyQ({ side: 'PAYABLE', areaId: AREA, collectionDay: 'MON' })),
      ).resolves.toMatchObject({ side: 'PAYABLE' });
    });

    it.each([
      ['buckets that break the rules', { buckets: '60,30' }, PARTY_OUTSTANDING_ERROR.BAD_BUCKETS, 'buckets'],
      ['an asOn that is not on the calendar', { asOn: '2026-02-30' }, PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS, 'asOn'],
      ['a due-days window that is reversed', { minDueDays: 30, maxDueDays: 10 }, PARTY_OUTSTANDING_ERROR.RANGE_REVERSED, 'minDueDays'],
    ])('refuses %s before reading the year', async (_label, extra, code, field) => {
      const refusal = await refusalOf(service.parties(partiesQ(extra)));

      expect(refusal).toMatchObject({ status: 422, body: { errors: [{ field, code }] } });
      expect(db.calls.map((c) => c.key)).toEqual(['menu']);
    });

    it('checks the buckets before the date', async () => {
      const refusal = await refusalOf(
        service.parties(partiesQ({ buckets: 'x', asOn: '2026-02-30' })),
      );

      expect(codeOf(refusal)).toBe(PARTY_OUTSTANDING_ERROR.BAD_BUCKETS);
    });

    it('reads the year asOn falls in, binding the date as text', async () => {
      await service.parties(partiesQ());

      const fy = db.one('fy');
      expect(fy.values).toEqual([COMPANY, AS_ON]);
      expect(fy.text).toContain('$2::date BETWEEN fy_begin_date AND fy_end_date');
    });

    it('refuses an asOn outside every year of the company', async () => {
      db.answer('fy', []);

      const refusal = await refusalOf(service.parties(partiesQ()));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'asOn',
              code: PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS,
              message: `${AS_ON} is outside every financial year set up for this company.`,
            },
          ],
        },
      });
    });

    it.each([
      ['a branch of another company', [{ br_comp_id: GROUP }]],
      ['a branch that does not exist', []],
    ])('refuses %s', async (_label, rows) => {
      db.answer('branch', rows);

      const refusal = await refusalOf(service.parties(partiesQ({ branchId: BRANCH })));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'branchId', code: PARTY_OUTSTANDING_ERROR.BRANCH_NOT_IN_COMPANY }] },
      });
    });

    it('checks no branch when none is named', async () => {
      await service.parties(partiesQ());

      expect(db.of('branch')).toEqual([]);
    });

    it('refuses a party of another company', async () => {
      db.answer('partyCheck', [{ ok: false }]);

      const refusal = await refusalOf(service.parties(partiesQ({ partyId: PARTY })));

      expect(db.one('partyCheck').values).toEqual([PARTY, COMPANY, PARTY, COMPANY]);
      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'partyId', code: PARTY_OUTSTANDING_ERROR.PARTY_NOT_IN_COMPANY }] },
      });
    });

    it('finds the default group by its pinned id first, then by name', async () => {
      await service.parties(partiesQ());
      await service.parties(partiesQ({ side: 'PAYABLE' }));

      const [debtors, creditors] = db.of('root');
      expect(debtors.values).toEqual([COMPANY, SUNDRY_DEBTORS_GROUP_ID, 'sundry debtors', SUNDRY_DEBTORS_GROUP_ID]);
      expect(creditors.values).toEqual([
        COMPANY,
        SUNDRY_CREDITORS_GROUP_ID,
        'sundry creditors',
        SUNDRY_CREDITORS_GROUP_ID,
      ]);
    });
  });

  // ── what the scope binds into the SQL ─────────────────────────────────────
  describe('the SQL a scope builds', () => {
    it('binds no JS Date anywhere: every date is YYYY-MM-DD text cast ::date', async () => {
      await service.parties(partiesQ({ branchId: BRANCH, partyId: PARTY }));
      await service.dueCalendar(calendarQ());

      for (const call of db.calls) {
        expect(call.values.some((v) => v instanceof Date)).toBe(false);
      }
      expect(db.one('parties').values).toContain(AS_ON);
      expect(db.one('parties').values).toContain('2026-10-21'); // today, in IST
    });

    it('takes every customer on Receivable with the default group (O3)', async () => {
      await service.parties(partiesQ());

      const { text, values } = db.one('parties');
      expect(text).toContain('l.led_group_id IN (SELECT id FROM grp) OR (c.cus_id IS NOT NULL');
      expect(values).toContain(SUNDRY_DEBTORS_GROUP_ID);
      expect(values).toContain('DR');
      expect(values).toContain('R');
    });

    it('takes every supplier on Payable, owed on the CR side', async () => {
      db.answer('root', [{ id: SUNDRY_CREDITORS_GROUP_ID }]);

      await service.parties(partiesQ({ side: 'PAYABLE' }));

      const { text, values } = db.one('parties');
      expect(text).toContain('OR (sp.sup_id IS NOT NULL');
      expect(text).toContain('NULL::uuid AS area_id');
      expect(values).toContain('CR');
      expect(values).toContain('P');
    });

    it('takes only the subtree for any other group', async () => {
      await service.parties(partiesQ({ groupId: GROUP }));

      const { text, values } = db.one('parties');
      expect(text).not.toContain('OR (c.cus_id IS NOT NULL');
      expect(values).toContain(GROUP);
    });

    it('still takes every customer when the chart lost its Sundry Debtors group', async () => {
      db.answer('root', []);

      await service.parties(partiesQ());

      const { text, values } = db.one('parties');
      expect(values).toContain(NIL_UUID);
      expect(text).toContain('OR (c.cus_id IS NOT NULL');
    });

    it('binds the collection day as its ISO weekday', async () => {
      await service.parties(partiesQ({ collectionDay: 'WED', areaId: AREA, salesmanId: SALESMAN }));

      const { text, values } = db.one('parties');
      expect(text).toContain('am.arm_collection_days @> ARRAY[');
      expect(values).toEqual(expect.arrayContaining([3, AREA, SALESMAN]));
    });

    it('drops the grid filters for one party, and lists it even with nothing open', async () => {
      db.answer('parties', [partyRow()]);

      await service.party(partyQ({ groupId: GROUP, areaId: AREA, hideZero: true, onlyOverdue: true }));

      const { text, values } = db.one('parties');
      // grp is seeded with NULL and nobody filters on it.
      expect(text).not.toContain('l.led_group_id IN (SELECT id FROM grp)');
      expect(values).not.toContain(GROUP);
      expect(values).not.toContain(AREA);
      expect(values).toContain(PARTY);
    });
  });

  // ── /options ──────────────────────────────────────────────────────────────
  describe('options', () => {
    it('lists the default group tree, areas, salesmen and branches on Receivable', async () => {
      db.answer('groups', [
        { id: SUNDRY_DEBTORS_GROUP_ID, name: 'Sundry Debtors', depth: 0 },
        { id: GROUP, name: 'Retail', depth: 1n },
      ]);
      db.answer('areas', [{ arm_id: AREA, arm_name: 'North', days: [3, 1, 9] }]);
      db.answer('salesmen', [{ emp_id: SALESMAN, emp_name: 'Kumar' }]);
      db.answer('branches', [{ br_id: BRANCH, br_name: 'Main' }]);

      await expect(service.options(plainToInstance(OutstandingOptionsDto, filter))).resolves.toEqual({
        groups: [
          { groupId: SUNDRY_DEBTORS_GROUP_ID, name: 'Sundry Debtors', depth: 0, isDefault: true },
          { groupId: GROUP, name: 'Retail', depth: 1, isDefault: false },
        ],
        areas: [{ areaId: AREA, name: 'North', collectionDays: ['MON', 'WED'] }],
        salesmen: [{ salesmanId: SALESMAN, name: 'Kumar' }],
        branches: [{ branchId: BRANCH, name: 'Main' }],
      });
      expect(db.one('groups').values).toEqual([SUNDRY_DEBTORS_GROUP_ID, COMPANY]);
      expect(db.one('branches').values).toEqual([COMPANY]);
    });

    it('reads no areas or salesmen on Payable', async () => {
      db.answer('root', [{ id: SUNDRY_CREDITORS_GROUP_ID }]);

      const options = await service.options(
        plainToInstance(OutstandingOptionsDto, { ...filter, side: 'PAYABLE' }),
      );

      expect(options.areas).toEqual([]);
      expect(options.salesmen).toEqual([]);
      expect(db.of('areas')).toEqual([]);
      expect(db.of('salesmen')).toEqual([]);
    });

    it('lists no groups when the chart has no default group', async () => {
      db.answer('root', []);

      await expect(
        service.options(plainToInstance(OutstandingOptionsDto, filter)),
      ).resolves.toMatchObject({ groups: [] });
      expect(db.of('groups')).toEqual([]);
    });
  });

  // ── /parties ──────────────────────────────────────────────────────────────
  describe('parties', () => {
    it('answers the head, one row per party, the totals and the page', async () => {
      db.answer('parties', [partyRow()]);

      const out = await service.parties(partiesQ());

      expect(out).toMatchObject({
        asOn: AS_ON,
        side: 'RECEIVABLE',
        isFuture: false,
        accYear: '2026-2027',
        bucketLabels: ['0–30', '31–60', '61–90', '91–180', '> 180'],
        page: { page: 1, pageSize: 200, totalRows: 1 },
      });
      expect(out.rows).toEqual([
        {
          partyId: PARTY,
          name: 'Ravi Stores',
          area: 'North',
          phone: '98400 00000',
          creditDays: 30,
          creditLimit: null,
          bills: 2,
          owed: '1500.50',
          onAccount: '200.00',
          net: { amount: '1300.50', side: 'DR' },
          buckets: ['1000.50', '0.00', '500.00', '0.00', '0.00'],
          overdue: '500.00',
          oldestDays: 75,
          pdcInHand: '0.00',
          flags: [],
        },
      ]);
    });

    it('says a future asOn is in the future (IST today, not UTC)', async () => {
      db.answer('fy', [{ name: '2026-2027 ' }]);

      const out = await service.parties(partiesQ({ asOn: '2026-10-22' }));

      expect(out.isFuture).toBe(true);
      expect(out.accYear).toBe('2026-2027');
    });

    it('labels a due-date ageing with Not due first', async () => {
      const out = await service.parties(partiesQ({ ageBy: 'DUE_DATE', buckets: '15,45' }));

      expect(out.bucketLabels).toEqual(['Not due', '0–15', '16–45', '> 45']);
      expect(out.totals.buckets).toHaveLength(4);
    });

    it.each([
      ['CHQ_BOUNCED', { bounced: true }],
      ['OVER_LIMIT', { credit_limit: dec(1000) }],
      ['OVER_180', { oldest: 181 }],
      ['ADVANCE', { net: dec(-50) }],
    ])('flags %s', async (flag, overrides) => {
      db.answer('parties', [partyRow(overrides)]);

      const [row] = (await service.parties(partiesQ())).rows;

      expect(row.flags).toEqual([flag]);
    });

    it('flags OVER_LIMIT on Receivable only, and only above a positive limit', async () => {
      db.answer('parties', [partyRow({ credit_limit: dec(1300.5) })]);
      expect((await service.parties(partiesQ())).rows[0].flags).toEqual([]);

      db.answer('root', [{ id: SUNDRY_CREDITORS_GROUP_ID }]);
      db.answer('parties', [partyRow({ credit_limit: dec(10) })]);
      expect((await service.parties(partiesQ({ side: 'PAYABLE' }))).rows[0].flags).toEqual([]);
    });

    it('puts OVER_180 past the LAST edge of the buckets in use', async () => {
      db.answer('parties', [partyRow({ oldest: 46 })]);

      const [row] = (await service.parties(partiesQ({ buckets: '15,45' }))).rows;

      expect(row.flags).toEqual(['OVER_180']);
    });

    it('shows a credit limit with two decimals and a missing oldest as null', async () => {
      db.answer('parties', [partyRow({ credit_limit: dec(5000), oldest: null, name: null })]);

      const [row] = (await service.parties(partiesQ())).rows;

      expect(row).toMatchObject({ creditLimit: '5000.00', oldestDays: null, name: '' });
    });

    it('builds the tiles and totals over every row, not the page', async () => {
      db.answer('parties', [
        partyRow({
          t_parties: 12n,
          t_bills: 40n,
          t_owed: dec(300),
          t_on_account: dec(50),
          t_net: dec(-25),
          t_b0: dec(100),
          t_b2: dec(200),
          t_overdue: dec(200),
          t_pdc_amt: dec(75),
          t_pdc_n: dec(3),
          t_above_amt: dec(120),
          t_above_parties: 4n,
          t_due_next: dec(60),
        }),
      ]);

      const out = await service.parties(partiesQ());

      expect(out.tiles).toEqual({
        net: { amount: '25.00', side: 'CR' },
        parties: 12,
        bills: 40,
        overdue: '200.00',
        overduePctOfOwed: '67',
        aboveDays: { days: 90, amount: '120.00', parties: 4 },
        onAccount: '50.00',
        pdcInHand: { amount: '75.00', cheques: 3 },
        dueNext: { days: 7, amount: '60.00', from: '2026-10-10', to: '2026-10-16' },
      });
      expect(out.totals).toEqual({
        bills: 40,
        owed: '300.00',
        onAccount: '50.00',
        net: { amount: '25.00', side: 'CR' },
        buckets: ['100.00', '0.00', '200.00', '0.00', '0.00'],
        overdue: '200.00',
        pdcInHand: '75.00',
      });
      expect(out.page.totalRows).toBe(12);
    });

    it('answers 0% overdue when nothing is owed, and a zero net with no side', async () => {
      const out = await service.parties(partiesQ());

      expect(out.tiles.overduePctOfOwed).toBe('0');
      expect(out.tiles.net).toEqual({ amount: '0.00', side: null });
    });

    it('answers the totals with no rows past the last page', async () => {
      db.answer('parties', [totRow({ t_parties: 3n, t_owed: dec(10) })]);

      const out = await service.parties(partiesQ({ page: 9, pageSize: 50 }));

      expect(out.rows).toEqual([]);
      expect(out.page).toEqual({ page: 9, pageSize: 50, totalRows: 3 });
      expect(out.totals.owed).toBe('10.00');
      // LIMIT 50 OFFSET 400
      expect(db.one('parties').values.slice(-2)).toEqual([50, 400]);
    });

    it.each([
      [{}, 'pf.net DESC NULLS LAST, lower(pf.name) ASC, pf.party_id ASC'],
      [{ sort: 'name', dir: 'asc' }, 'lower(pf.name) ASC NULLS LAST, lower(pf.name) ASC'],
      [{ sort: 'oldest' }, 'pf.oldest DESC NULLS LAST'],
      [{ sort: 'bucket4' }, 'pf.b4 DESC NULLS LAST'],
    ])('orders by %j with stable ties', async (extra, order) => {
      await service.parties(partiesQ(extra));

      expect(db.one('parties').text).toContain(`ORDER BY ${order}`);
    });

    it('refuses a bucket sort the buckets do not have', async () => {
      const refusal = await refusalOf(service.parties(partiesQ({ sort: 'bucket5' })));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'sort',
              code: PARTY_OUTSTANDING_ERROR.BAD_SORT,
              message: 'bucket5: these buckets have 5 columns (bucket0 … bucket4).',
            },
          ],
        },
      });
      expect(db.of('parties')).toEqual([]);
    });

    it('takes bucket5 once due-date ageing adds the Not due column', async () => {
      await expect(
        service.parties(partiesQ({ sort: 'bucket5', ageBy: 'DUE_DATE' })),
      ).resolves.toBeDefined();
    });
  });

  // ── /party — the card ─────────────────────────────────────────────────────
  describe('party', () => {
    const facts = {
      led_name: 'Ravi Stores',
      group_name: 'Sundry Debtors',
      led_gstin_no: '33AAAAA0000A1Z5',
      led_phone1: '044 1111',
      is_cus: true,
      is_sup: true,
      cus_phone1: '  ',
      cus_phone2: '98400 00000',
      cus_gst_no: null,
      cus_credit_days: 30,
      cus_credit_amt_limit: dec(50000),
      cus_credit_bill_limit: 5,
      arm_name: 'North',
      sup_phone: '99999 11111',
      sup_gst_no: '33SUPPL0000A1Z5',
      sup_credit_days: 45,
    };

    beforeEach(() => {
      db.answer('facts', [facts]);
      db.answer('parties', [partyRow()]);
    });

    it('assembles the facts, ageing, figures, on-account items, PDC and last settlement', async () => {
      db.answer('onAccount', [
        {
          abl_id: BILL_2,
          abl_acc_year: '2026-2027',
          doc_refno: 'ADV/1',
          abl_doc_date: day('2026-09-15'),
          abl_bill_type: 'ADVANCE',
          pending: dec(200),
        },
      ]);
      db.answer('pdcs', [
        {
          apd_id: 'pdc-1',
          apd_acc_year: '2026-2027 ',
          apd_instrument_no: '000123',
          apd_bank_name: 'SBI',
          apd_instrument_date: day('2026-10-09'),
          apd_amount: dec(300),
          apd_status: 'DEPOSITED',
        },
        {
          apd_id: 'pdc-2',
          apd_acc_year: '2026-2027',
          apd_instrument_no: '000124',
          apd_bank_name: null,
          apd_instrument_date: day('2026-10-20'),
          apd_amount: dec(400),
          apd_status: 'HELD',
        },
      ]);
      db.answer('lastSettlement', [
        {
          vid: VOUCHER,
          vyr: '2026-2027 ',
          d: day('2026-10-05'),
          amt: dec('750.25'),
          refno: 'RCP/9',
          vtype: 'Receipt',
        },
      ]);

      const card = await service.party(partyQ());

      expect(card).toEqual({
        asOn: AS_ON,
        side: 'RECEIVABLE',
        isFuture: false,
        accYear: '2026-2027',
        bucketLabels: ['0–30', '31–60', '61–90', '91–180', '> 180'],
        party: {
          partyId: PARTY,
          name: 'Ravi Stores',
          ledgerGroup: 'Sundry Debtors',
          area: 'North',
          phone: '98400 00000',
          gstin: '33AAAAA0000A1Z5',
          creditDays: 30,
          creditLimit: '50000.00',
          creditBillLimit: 5,
          isDualRole: true,
        },
        ageing: {
          labels: ['0–30', '31–60', '61–90', '91–180', '> 180'],
          amounts: ['1000.50', '0.00', '500.00', '0.00', '0.00'],
        },
        owed: '1500.50',
        onAccount: '200.00',
        net: { amount: '1300.50', side: 'DR' },
        onAccountItems: [
          {
            billId: BILL_2,
            accYear: '2026-2027',
            docRefno: 'ADV/1',
            date: '2026-09-15',
            type: 'ADVANCE',
            amount: '200.00',
          },
        ],
        // Dated after asOn: not yet counted, so "in hand".
        pdcInHand: [
          {
            pdcId: 'pdc-2',
            accYear: '2026-2027',
            chequeNo: '000124',
            bank: null,
            chequeDate: '2026-10-20',
            amount: '400.00',
            status: 'HELD',
          },
        ],
        // Dated on asOn and not cleared: already counted as settled.
        pdcEffectiveUncleared: [
          {
            pdcId: 'pdc-1',
            accYear: '2026-2027',
            chequeNo: '000123',
            bank: 'SBI',
            chequeDate: '2026-10-09',
            amount: '300.00',
            status: 'DEPOSITED',
          },
        ],
        lastSettlement: {
          date: '2026-10-05',
          voucherId: VOUCHER,
          voucherAccYear: '2026-2027',
          voucherNo: 'RCP/9',
          voucherType: 'Receipt',
          amount: '750.25',
        },
      });
    });

    it("takes the supplier's phone and GSTIN on Payable, and no area or credit limit", async () => {
      db.answer('root', [{ id: SUNDRY_CREDITORS_GROUP_ID }]);

      const { party } = await service.party(partyQ({ side: 'PAYABLE' }));

      expect(party).toMatchObject({
        area: null,
        phone: '99999 11111',
        gstin: '33SUPPL0000A1Z5',
        creditDays: 45,
        creditLimit: null,
        creditBillLimit: null,
      });
    });

    it('answers zeros for a party with nothing open, and an empty card for an unknown ledger', async () => {
      db.answer('parties', [totRow()]);
      db.answer('facts', []);

      const card = await service.party(partyQ());

      expect(card).toMatchObject({
        party: { name: '', ledgerGroup: null, phone: null, isDualRole: false, creditLimit: null },
        ageing: { amounts: ['0.00', '0.00', '0.00', '0.00', '0.00'] },
        owed: '0.00',
        onAccount: '0.00',
        net: { amount: '0.00', side: null },
        lastSettlement: null,
      });
    });

    it('reads the figures whole: the bill-level due filters are dropped for the card', async () => {
      await service.party(partyQ({ onlyOverdue: true, minDueDays: 5, maxDueDays: 9 }));

      const { text, values } = db.one('parties');
      // dueWindow binds onlyOverdue, minDueDays, maxDueDays — all off for the card.
      expect(text).toContain('bool_or(');
      expect(values).not.toContain(5);
      expect(values).not.toContain(9);
      expect(db.one('onAccount').values).not.toContain(5);
    });

    it('takes the PDC of the side, company, party and branch received on or before asOn', async () => {
      await service.party(partyQ({ branchId: BRANCH }));

      expect(db.one('pdcs').values).toEqual([COMPANY, PARTY, 'R', AS_ON, BRANCH, BRANCH]);
    });

    it('takes the last live ALLOCATION on an owed bill as the last settlement', async () => {
      await service.party(partyQ());

      const { text, values } = db.one('lastSettlement');
      expect(text).toContain("a.abj_adj_type = 'ALLOCATION'");
      expect(text).toContain('a.abj_reversal_of_id IS NULL');
      expect(text).toContain('b.abl_is_deleted = false');
      expect(values).toEqual([COMPANY, PARTY, 'DR', null, null, AS_ON]);
    });
  });

  // ── /bills and /bill-wise ─────────────────────────────────────────────────
  describe('bills', () => {
    it('lists every open item of the party unpaged, with totals and the ledger closing', async () => {
      db.answer('bills', [billDbRow()]);
      db.answer('ledgerClosing', [{ bal: dec('-1250.4') }]);

      const out = await service.bills(partyQ());

      expect(out).toMatchObject({
        asOn: AS_ON,
        partyId: PARTY,
        totals: { bills: 1, billAmount: '1000.00', adjusted: '400.00', net: { amount: '600.00', side: 'DR' } },
        // The ledger's own sign: a negative balance is CR whatever the side.
        ledgerClosing: { amount: '1250.40', side: 'CR' },
      });
      expect(out.rows).toEqual([
        {
          billId: BILL,
          accYear: '2026-2027',
          branchName: 'Main',
          docDate: '2026-09-01',
          docRefno: 'SB/001',
          billType: 'SALE',
          srcDocType: 'SALE_BILL',
          srcDocId: 'sb-1',
          srcAccYear: '2026-2027',
          voucherId: VOUCHER,
          side: 'OWED',
          dueDate: null,
          dueEff: '2026-10-01',
          billAmount: '1000.00',
          adjusted: '400.00',
          pending: '600.00',
          ageDays: 38,
          overdueDays: 8,
          remarks: null,
          tenderDerived: false,
          partyId: PARTY,
          partyName: 'Ravi Stores',
          area: 'North',
        },
      ]);
      expect(db.one('bills').text).not.toContain('LIMIT');
      expect(db.one('bills').text).toContain('ORDER BY x.abl_doc_date ASC NULLS LAST');
    });

    it('marks an on-account item, and never gives it overdue days', async () => {
      db.answer('bills', [billDbRow({ is_owed: false, overdue_days: 12, abl_due_date: day('2026-09-30') })]);

      const [row] = (await service.bills(partyQ())).rows;

      expect(row).toMatchObject({
        side: 'ON_ACCOUNT',
        overdueDays: null,
        dueDate: '2026-09-30',
        remarks: 'on account',
      });
    });

    it('marks a counter-tendered bill, and flags one whose rows exceed its cache', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      db.answer('bills', [
        billDbRow({ gap: dec(150) }),
        billDbRow({ abl_id: BILL_2, doc_refno: 'SB/002', gap: dec(-5) }),
      ]);

      const rows = (await service.bills(partyQ())).rows;

      expect(rows[0]).toMatchObject({ tenderDerived: true });
      expect(rows[0]).not.toHaveProperty('dataWarning');
      expect(rows[1]).toMatchObject({ tenderDerived: false, dataWarning: 'ALLOC_BELOW_ROWS' });
      expect(warn).toHaveBeenCalledWith(
        'ALLOC_BELOW_ROWS: adjustment rows exceed the cached settlement on 1 bill(s): SB/002',
      );
    });

    it('reads no adjustment rows when no owed bill is listed', async () => {
      db.answer('bills', [
        billDbRow({ is_owed: false }),
        billDbRow({ abl_id: BILL_2, abl_src_doc_type: 'CHEQUE_BOUNCE_CHARGE' }),
      ]);

      const rows = (await service.bills(partyQ())).rows;

      expect(rows.map((r) => r.remarks)).toEqual(['on account', 'bounce charge']);
      expect(db.of('remarks')).toEqual([]);
    });

    describe('remarks', () => {
      const adj = (o: Record<string, unknown>) => ({
        abj_id: 'a1',
        bill_id: BILL,
        bill_yr: '2026-2027 ',
        adj_type: 'ALLOCATION',
        adj_date: day('2026-09-10'),
        created_on: null,
        row_no: 1,
        reversal_of: null,
        reason: null,
        refno: 'RCP/1',
        ...o,
      });

      it.each([
        ['part <voucher> for a surviving allocation', [adj({})], 'part RCP/1'],
        ['disc for a discount', [adj({ adj_type: 'DISCOUNT', refno: 'JV/2' })], 'disc JV/2'],
        ['disc for a round-off', [adj({ adj_type: 'ROUND_OFF', refno: null })], 'disc'],
        ['w/off for a write-off', [adj({ adj_type: 'WRITEOFF', refno: 'JV/3' })], 'w/off JV/3'],
        [
          're-opened when every row was retracted',
          [adj({}), adj({ abj_id: 'a2', reversal_of: 'a1', reason: 'receipt cancelled', amount: -1 })],
          're-opened',
        ],
        [
          're-opened · chq bounced when the latest row is a bounce',
          [adj({}), adj({ abj_id: 'a2', reversal_of: 'a1', reason: 'Cheque BOUNCED' })],
          're-opened · chq bounced',
        ],
        [
          'the latest surviving row, past a retracted pair',
          [
            adj({ abj_id: 'a1', refno: 'RCP/1' }),
            adj({ abj_id: 'a2', refno: 'RCP/2' }),
            adj({ abj_id: 'a3', reversal_of: 'a2', reason: 'cancelled' }),
          ],
          'part RCP/1',
        ],
      ])('says %s', async (_label, rows, remark) => {
        db.answer('bills', [billDbRow()]);
        db.answer('remarks', rows);

        const [row] = (await service.bills(partyQ())).rows;

        expect(row.remarks).toBe(remark);
      });

      it('reads the rows of the owed bills dated on or before asOn', async () => {
        db.answer('bills', [billDbRow(), billDbRow({ abl_id: BILL_2, abl_acc_year: '2025-2026' })]);

        await service.bills(partyQ());

        const { text, values } = db.one('remarks');
        expect(text).toContain('a.abj_is_deleted = false');
        expect(values).toEqual([BILL, '2026-2027', BILL_2, '2025-2026', AS_ON]);
      });
    });
  });

  describe('billWise', () => {
    it('pages the open items across parties, the totals over every row', async () => {
      db.answer('bills', [billDbRow({ t_bills: 31n })]);

      const out = await service.billWise(billWiseQ({ page: 2, pageSize: 10, sort: 'pending', dir: 'desc' }));

      expect(out.page).toEqual({ page: 2, pageSize: 10, totalRows: 31 });
      const { text, values } = db.one('bills');
      expect(text).toContain('ORDER BY x.pending DESC NULLS LAST, x.abl_doc_date ASC, x.doc_refno ASC');
      expect(values.slice(-2)).toEqual([10, 10]);
    });

    it('narrows to the owed bills due on one day for the calendar click', async () => {
      await service.billWise(billWiseQ({ dueOn: '2026-10-15' }));

      const { text, values } = db.one('bills');
      expect(text).toContain('x.is_owed AND x.due_eff = ');
      expect(values.filter((v) => v === '2026-10-15')).toHaveLength(2);
    });

    it('refuses a dueOn that is not on the calendar', async () => {
      const refusal = await refusalOf(service.billWise(billWiseQ({ dueOn: '2026-02-30' })));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'dueOn',
              code: PARTY_OUTSTANDING_ERROR.RANGE_REVERSED,
              message: '2026-02-30 is not a calendar date.',
            },
          ],
        },
      });
      expect(db.of('bills')).toEqual([]);
    });

    it('applies the due-days window to the bills themselves', async () => {
      await service.billWise(billWiseQ({ onlyOverdue: true }));

      expect(db.one('bills').text).toContain('o AS (SELECT ob.* FROM ob WHERE (ob.is_owed');
    });
  });

  // ── /bill-history ─────────────────────────────────────────────────────────
  describe('billHistory', () => {
    const bill = {
      abl_id: BILL,
      abl_acc_year: '2026-2027 ',
      abl_party_id: PARTY,
      doc_refno: 'SB/001',
      abl_doc_date: day('2026-09-01'),
      abl_bill_type: 'SALE',
      dr_cr: 'DR',
      abl_bill_amount: dec(1000),
      // 300 by the receipt row + 300 at the counter, which has no row.
      cached: dec(600),
    };
    const row = (o: Record<string, unknown>) => ({
      abj_id: 'a1',
      abj_adj_date: day('2026-09-10'),
      abj_adj_type: 'ALLOCATION',
      abj_voucher_id: VOUCHER,
      abj_voucher_acc_year: '2026-2027 ',
      refno: 'RCP/1',
      vtype: 'Receipt',
      against_refno: null,
      abj_amount: dec(300),
      abj_reversal_of_id: null,
      abj_reversal_reason: null,
      post_dated: false,
      cheque_no: null,
      ...o,
    });

    it('applies the pending formula to one bill: bill − rows ≤ asOn − the counter tender', async () => {
      db.answer('historyBill', [bill]);
      db.answer('historyRows', [
        row({}),
        // A post-dated cheque dated after today: neither counted on asOn nor in the cache.
        row({
          abj_id: 'a2',
          abj_adj_date: day('2026-11-15'),
          abj_amount: dec(200),
          post_dated: true,
          cheque_no: '000777',
        }),
      ]);

      const out = await service.billHistory(historyQ());

      expect(out).toEqual({
        asOn: AS_ON,
        bill: {
          billId: BILL,
          accYear: '2026-2027',
          partyId: PARTY,
          docRefno: 'SB/001',
          docDate: '2026-09-01',
          billType: 'SALE',
          side: 'DR',
          billAmount: '1000.00',
          pending: '400.00',
        },
        rows: [
          {
            adjustmentId: 'a1',
            date: '2026-09-10',
            adjType: 'ALLOCATION',
            voucherId: VOUCHER,
            voucherAccYear: '2026-2027',
            voucherNo: 'RCP/1',
            voucherType: 'Receipt',
            againstDocRefno: null,
            amount: '300.00',
            isReversal: false,
            reversalReason: null,
            isPostDated: false,
            chequeNo: null,
            effective: true,
          },
          expect.objectContaining({
            adjustmentId: 'a2',
            isPostDated: true,
            chequeNo: '000777',
            effective: false,
          }),
        ],
        tenderAtBill: '300.00',
      });
      expect(db.one('historyBill').values).toEqual([BILL, '2026-2027', COMPANY]);
      expect(db.one('historyBill').text).toContain('abl_is_deleted = false');
    });

    it('counts a retracted pair as nothing, and names the reversal', async () => {
      db.answer('historyBill', [{ ...bill, cached: dec(0) }]);
      db.answer('historyRows', [
        row({}),
        row({ abj_id: 'a2', abj_amount: dec(-300), abj_reversal_of_id: 'a1', abj_reversal_reason: 'cancelled' }),
      ]);

      const out = await service.billHistory(historyQ());

      expect(out.bill.pending).toBe('1000.00');
      expect(out.tenderAtBill).toBeNull();
      expect(out.rows[1]).toMatchObject({ amount: '-300.00', isReversal: true, reversalReason: 'cancelled' });
    });

    it('answers 0 pending for a bill dated after asOn', async () => {
      db.answer('historyBill', [{ ...bill, abl_doc_date: day('2026-10-20') }]);

      await expect(service.billHistory(historyQ())).resolves.toMatchObject({
        bill: { pending: '0.00' },
      });
    });

    it('flags a bill whose rows exceed its cached settlement', async () => {
      db.answer('historyBill', [{ ...bill, cached: dec(100), dr_cr: 'CR' }]);
      db.answer('historyRows', [row({ abj_voucher_acc_year: null })]);

      const out = await service.billHistory(historyQ());

      expect(out).toMatchObject({ dataWarning: 'ALLOC_BELOW_ROWS', tenderAtBill: null });
      expect(out.bill.side).toBe('CR');
      expect(out.rows[0].voucherAccYear).toBeNull();
    });

    it('answers 404 for a bill the company does not have', async () => {
      const refusal = await refusalOf(service.billHistory(historyQ()));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Bill not found',
          errors: [
            {
              field: 'billId',
              message: `No bill ${BILL} in 2026-2027 for this company`,
              code: PARTY_OUTSTANDING_ERROR.BILL_NOT_FOUND,
            },
          ],
        },
      });
      expect(db.of('historyRows')).toEqual([]);
    });

    it('refuses an asOn that is not on the calendar', async () => {
      const refusal = await refusalOf(service.billHistory(historyQ({ asOn: '2026-02-30' })));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'asOn', code: PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS }] },
      });
      expect(db.of('historyBill')).toEqual([]);
    });
  });

  // ── /summary ──────────────────────────────────────────────────────────────
  describe('summary', () => {
    it.each(['AREA', 'SALESMAN'])('refuses %s on Payable before anything else', async (groupBy) => {
      const refusal = await refusalOf(service.summary(summaryQ({ side: 'PAYABLE', groupBy })));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'groupBy', code: PARTY_OUTSTANDING_ERROR.NOT_FOR_PAYABLE }] },
      });
      expect(db.calls.map((c) => c.key)).toEqual(['menu']);
    });

    it('groups the parties, names a missing key, and drops empty rows', async () => {
      db.answer('summaryParty', [
        {
          key: GROUP,
          name: 'Retail',
          parties: 3n,
          owed: dec(900),
          on_account: dec(100),
          net: dec(800),
          b0: dec(900),
          b1: dec(0),
          b2: dec(0),
          b3: dec(0),
          b4: dec(0),
          overdue: dec(0),
        },
        { key: null, name: null, parties: 1n, owed: dec(0), on_account: dec(40), net: dec(-40), b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, overdue: 0 },
        { key: 'empty', name: 'Empty', parties: 0n, owed: 0, on_account: 0, net: dec(0), b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, overdue: 0 },
      ]);
      db.answer('parties', [totRow({ t_parties: 4n, t_owed: dec(900), t_on_account: dec(140), t_net: dec(760) })]);

      const out = await service.summary(summaryQ());

      expect(out.groupBy).toBe('GROUP');
      expect(out.rows).toEqual([
        {
          key: GROUP,
          name: 'Retail',
          parties: 3,
          owed: '900.00',
          onAccount: '100.00',
          net: { amount: '800.00', side: 'DR' },
          buckets: ['900.00', '0.00', '0.00', '0.00', '0.00'],
          overdue: '0.00',
        },
        {
          key: null,
          name: '(no group)',
          parties: 1,
          owed: '0.00',
          onAccount: '40.00',
          net: { amount: '40.00', side: 'CR' },
          buckets: ['0.00', '0.00', '0.00', '0.00', '0.00'],
          overdue: '0.00',
        },
      ]);
      expect(out.totals).toEqual({
        parties: 4,
        owed: '900.00',
        onAccount: '140.00',
        net: { amount: '760.00', side: 'DR' },
        buckets: ['0.00', '0.00', '0.00', '0.00', '0.00'],
        overdue: '0.00',
      });
      expect(db.one('summaryParty').text).toContain('pf.group_id AS key');
    });

    it.each([
      ['AREA', 'pf.area_id AS key', '(no area)'],
      ['SALESMAN', 'pf.salesman_id AS key', '(no salesman)'],
    ])('groups by %s on Receivable', async (groupBy, key, blank) => {
      db.answer('summaryParty', [{ key: null, name: null, parties: 1n, owed: 1, on_account: 0, net: 1, b0: 1, b1: 0, b2: 0, b3: 0, b4: 0, overdue: 0 }]);

      const out = await service.summary(summaryQ({ groupBy }));

      expect(db.one('summaryParty').text).toContain(key);
      expect(out.rows[0].name).toBe(blank);
    });

    it('groups by the bill branch, keeping a PDC-only branch', async () => {
      db.answer('summaryBranch', [
        { key: BRANCH, name: null, parties: 0n, owed: 0, on_account: 0, net: dec(-75), b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, overdue: 0 },
      ]);

      const out = await service.summary(summaryQ({ groupBy: 'BRANCH', deductPdc: true }));

      expect(out.rows).toEqual([expect.objectContaining({ key: BRANCH, name: '(no branch)', parties: 0 })]);
      expect(db.of('summaryParty')).toEqual([]);
    });
  });

  // ── /due-calendar ─────────────────────────────────────────────────────────
  describe('dueCalendar', () => {
    it.each([
      ['a from that is not on the calendar', { from: '2026-02-30' }],
      ['a to that is not on the calendar', { to: '2026-13-01' }],
      ['from after to', { from: '2026-10-31', to: '2026-10-01' }],
    ])('refuses %s as RANGE_REVERSED', async (_label, extra) => {
      const refusal = await refusalOf(service.dueCalendar(calendarQ(extra)));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'from', code: PARTY_OUTSTANDING_ERROR.RANGE_REVERSED }] },
      });
      expect(db.calls.map((c) => c.key)).toEqual(['menu']);
    });

    it('refuses more than 92 days, and takes exactly 92', async () => {
      const refusal = await refusalOf(
        service.dueCalendar(calendarQ({ from: '2026-10-01', to: '2027-01-01' })),
      );
      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'to',
              code: PARTY_OUTSTANDING_ERROR.RANGE_TOO_LARGE,
              message: '93 days — the calendar shows at most 92.',
            },
          ],
        },
      });

      await expect(
        service.dueCalendar(calendarQ({ from: '2026-10-01', to: '2026-12-31' })),
      ).resolves.toBeDefined();
    });

    it('lists the days with something due and the overdue before the range', async () => {
      db.answer('calendar', [
        { kind: 'B', d: null, amt: dec(500), n: 4n, parties: 2n },
        { kind: 'D', d: day('2026-10-12'), amt: dec('120.5'), n: 2n, parties: 1n },
        { kind: 'D', d: day('2026-10-20'), amt: dec(80), n: 1n, parties: 1n },
      ]);

      const out = await service.dueCalendar(calendarQ());

      expect(out).toEqual({
        asOn: AS_ON,
        side: 'RECEIVABLE',
        from: '2026-10-10',
        to: '2026-10-31',
        days: [
          { date: '2026-10-12', amount: '120.50', bills: 2, parties: 1 },
          { date: '2026-10-20', amount: '80.00', bills: 1, parties: 1 },
        ],
        overdueBefore: { amount: '500.00', bills: 4 },
      });
      const { text, values } = db.one('calendar');
      expect(text).toContain('x.due_eff BETWEEN');
      expect(values).toEqual(expect.arrayContaining(['2026-10-10', '2026-10-31']));
    });

    it('answers no overdue when the before-row is missing', async () => {
      await expect(service.dueCalendar(calendarQ())).resolves.toMatchObject({
        days: [],
        overdueBefore: { amount: '0.00', bills: 0 },
      });
    });
  });

  // ── /export ───────────────────────────────────────────────────────────────
  describe('export', () => {
    beforeEach(() => {
      db.answer('names', [
        { company: 'Zeta Traders', branch: null, grp: 'Sundry Debtors', area: null, salesman: null, party: null },
      ]);
    });

    it('refuses a party statement without a party', async () => {
      const refusal = await refusalOf(service.export(exportQ({ shape: 'PARTY_STATEMENT' })));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'partyId', code: PARTY_OUTSTANDING_ERROR.PARTY_REQUIRED }] },
      });
    });

    it('answers the PARTIES rows unpaged with totals, tiles and the filters in words', async () => {
      db.answer('parties', [partyRow()]);

      const out = await service.export(exportQ());

      expect(out).toMatchObject({
        shape: 'PARTIES',
        companyName: 'Zeta Traders',
        branchName: null,
        totalRows: 1,
        printedAs:
          'Receivable outstanding as on 09-10-2026 (as the books stand today) · Branch: All branches · ' +
          'Group: Sundry Debtors (+ sub-groups) · Aged by bill date · Buckets 30, 60, 90, 180',
      });
      // EXPORT_ROW_CAP + 1, so a 20,001st row proves the cap.
      expect(db.one('parties').values.slice(-2)).toEqual([20_001, 0]);
    });

    it('refuses a PARTIES export past 20,000 rows', async () => {
      db.answer('parties', [partyRow({ t_parties: 20_001n })]);

      const refusal = await refusalOf(service.export(exportQ()));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'Range too large',
          errors: [
            {
              field: 'shape',
              code: PARTY_OUTSTANDING_ERROR.RANGE_TOO_LARGE,
              count: 20_001,
              message: '20001 rows — the export stops at 20000. Narrow the filters.',
            },
          ],
        },
      });
    });

    it.each([
      ['a bill sort on PARTIES', { shape: 'PARTIES', sort: 'date' }, 'date is not a party sort.'],
      ['a party sort on BILLS', { shape: 'BILLS', sort: 'net' }, 'net is not a bill sort.'],
    ])('refuses %s', async (_label, extra, message) => {
      const refusal = await refusalOf(service.export(exportQ(extra)));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'sort', code: PARTY_OUTSTANDING_ERROR.BAD_SORT, message }] },
      });
    });

    it('refuses a bucket sort the export buckets do not have', async () => {
      const refusal = await refusalOf(service.export(exportQ({ sort: 'bucket6' })));

      expect(codeOf(refusal)).toBe(PARTY_OUTSTANDING_ERROR.BAD_SORT);
    });

    it('answers the BILLS rows unpaged, capped the same way', async () => {
      db.answer('bills', [billDbRow({ t_bills: 1n })]);

      const out = await service.export(exportQ({ shape: 'BILLS', sort: 'due', dir: 'desc' }));

      expect(out).toMatchObject({ shape: 'BILLS', totalRows: 1, totals: { bills: 1 } });
      expect(db.one('bills').text).toContain('ORDER BY x.due_eff DESC');

      db.answer('bills', [billDbRow({ t_bills: 20_001n })]);
      const refusal = await refusalOf(service.export(exportQ({ shape: 'BILLS' })));
      expect(codeOf(refusal)).toBe(PARTY_OUTSTANDING_ERROR.RANGE_TOO_LARGE);
    });

    it("answers one party's statement: the card's figures with its open bills", async () => {
      db.answer('parties', [partyRow()]);
      db.answer('bills', [billDbRow()]);
      db.answer('facts', [{ led_name: 'Ravi Stores', is_cus: true, is_sup: false }]);
      db.answer('names', [
        { company: 'Zeta Traders', branch: 'Main', grp: null, area: null, salesman: null, party: 'Ravi Stores' },
      ]);

      const out = await service.export(
        exportQ({ shape: 'PARTY_STATEMENT', partyId: PARTY, branchId: BRANCH, hideZero: false }),
      );

      expect(out).toMatchObject({
        shape: 'PARTY_STATEMENT',
        party: { partyId: PARTY, name: 'Ravi Stores' },
        owed: '1500.50',
        net: { amount: '1300.50', side: 'DR' },
        totals: { bills: 1 },
        totalRows: 1,
        branchName: 'Main',
        printedAs:
          'Receivable outstanding as on 09-10-2026 (as the books stand today) · Branch: Main · ' +
          'Party: Ravi Stores · Aged by bill date · Buckets 30, 60, 90, 180',
      });
    });

    it('puts every applied filter in the printed sentence', async () => {
      db.answer('names', [
        { company: null, branch: 'Main', grp: 'Retail', area: 'North', salesman: 'Kumar', party: null },
      ]);

      const out = await service.export(
        exportQ({
          branchId: BRANCH,
          groupId: GROUP,
          areaId: AREA,
          salesmanId: SALESMAN,
          collectionDay: 'FRI',
          partyId: PARTY,
          ageBy: 'DUE_DATE',
          buckets: '15,45',
          onlyOverdue: true,
          minDueDays: 1,
          maxDueDays: 60,
          includeOnAccount: false,
          deductPdc: true,
          hideZero: false,
          sort: 'bucket3',
        }),
      );

      expect(out.printedAs).toBe(
        'Receivable outstanding as on 09-10-2026 (as the books stand today) · Branch: Main · ' +
          `Group: Retail (+ sub-groups) · Party: ${PARTY} · Area: North · Salesman: Kumar · ` +
          'Collection: FRI · Aged by due date · Buckets 15, 45 · Only overdue · Due days ≥ 1 · ' +
          'Due days ≤ 60 · On-account excluded · PDC in hand deducted · Zero balances shown',
      );
      expect(db.one('names').values).toEqual([COMPANY, BRANCH, GROUP, AREA, SALESMAN, PARTY]);
    });

    it('falls back to the ids when a name cannot be read', async () => {
      db.answer('names', []);

      const out = await service.export(
        exportQ({ side: 'RECEIVABLE', areaId: AREA, salesmanId: SALESMAN }),
      );

      expect(out.printedAs).toContain(`Area: ${AREA} · Salesman: ${SALESMAN}`);
      expect(out.companyName).toBeNull();
      expect(out.printedAs).not.toContain('Group:');
    });
  });
});
