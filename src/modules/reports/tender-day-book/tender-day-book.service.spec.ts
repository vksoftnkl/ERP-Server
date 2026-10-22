import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TenderDayBookService } from './tender-day-book.service';
import { TENDER_BOOKS_ERROR } from './tender-day-book.types';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b009';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
const CASH_LEDGER = '019c6f6c-be87-7a11-8905-36092c46b010';
const BANK_LEDGER = '019c6f6c-be87-7a11-8905-36092c46b011';
const CASH_TENDER = '019c6f6c-be87-7a11-8905-36092c46b020';
const UPI_TENDER = '019c6f6c-be87-7a11-8905-36092c46b021';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46b030';
const ACC_YEAR = '2026-2027';

const D = (v: string | number) => new Prisma.Decimal(v);

/** One raw tagged-template call, rebuilt the way Prisma sends it. */
const asSql = (args: unknown[]) =>
  Prisma.sql(args[0] as TemplateStringsArray, ...(args.slice(1) as unknown[]));

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

interface AggRow {
  ledger_id: string;
  ledger_name: string;
  ledger_type: 'CASH' | 'BANK';
  tender_id: string | null;
  tender_name: string | null;
  tender_type_id: number | null;
  tender_type_name: string | null;
  opening: Prisma.Decimal;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

const agg = (overrides: Partial<AggRow> = {}): AggRow => ({
  ledger_id: CASH_LEDGER,
  ledger_name: 'Cash in Hand',
  ledger_type: 'CASH',
  tender_id: CASH_TENDER,
  tender_name: 'CASH',
  tender_type_id: 1,
  tender_type_name: 'Cash',
  opening: D(0),
  debit: D(0),
  credit: D(0),
  ...overrides,
});

const line = (overrides: Record<string, unknown> = {}) => ({
  voucher_id: VOUCHER_ID,
  acc_year: ACC_YEAR,
  voucher_date: '2026-10-16',
  voucher_type_id: 7,
  voucher_type_code: 'RcpV',
  refno: 'RCV00140',
  branch_id: BRANCH_ID,
  session_id: null,
  party_id: null,
  party_name: null,
  ledger_id: CASH_LEDGER,
  ledger_name: 'Cash in Hand',
  ledger_type: 'CASH',
  side: 'DR',
  is_mirror: false,
  tender_id: CASH_TENDER,
  tender_name: 'CASH',
  tender_type_id: 1,
  tender_type_name: 'Cash',
  amount: D('100.5'),
  ...overrides,
});

type Kind = 'menu' | 'year' | 'branch' | 'agg' | 'sets' | 'byType' | 'rows';

/** Names a raw read by what it is for, so a test can feed and inspect each one. */
const kindOf = (text: string): Kind => {
  if (text.includes('public.user_menus')) return 'menu';
  if (text.includes('public.fiscal_years')) return 'year';
  if (text.includes('public.branch_master')) return 'branch';
  if (text.includes('WITH x0 AS')) return 'agg';
  if (text.includes('acc_opening_balance')) return 'sets';
  if (text.includes('GROUP BY vt.vchr_type_code')) return 'byType';
  if (text.includes('LIMIT')) return 'rows';
  throw new Error(`unexpected read: ${text.slice(0, 80)}`);
};

describe('TenderDayBookService', () => {
  let feed: {
    menu: unknown[];
    year: unknown[];
    branch: unknown[];
    agg: AggRow[];
    sets: unknown[];
    byType: unknown[];
    /** Every line of the range; the fake applies the query's own filter and LIMIT. */
    lines: ReturnType<typeof line>[];
  };
  let reads: Array<{ kind: Kind; sql: Prisma.Sql }>;
  let tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let prisma: { $transaction: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: TenderDayBookService;

  beforeEach(() => {
    feed = {
      menu: [{ ok: true }],
      year: [{ begin: '2026-04-01', end: '2027-03-31', today: '2026-10-21' }],
      branch: [{ br_comp_id: COMPANY_ID }],
      agg: [],
      sets: [],
      byType: [],
      lines: [],
    };
    reads = [];
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn(async (...args: unknown[]) => {
        const sql = asSql(args);
        const kind = kindOf(sql.text);
        reads.push({ kind, sql });
        if (kind !== 'rows') return feed[kind];
        // The last two bound values are `noTenderOnly` and the LIMIT.
        const [noTenderOnly, cap] = sql.values.slice(-2) as [boolean, number];
        return feed.lines.filter((l) => !noTenderOnly || l.tender_id === null).slice(0, cap);
      }),
    };
    prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new TenderDayBookService(prisma as unknown as PrismaService, context as never);
  });

  const read = (kind: Kind) => reads.find((r) => r.kind === kind)?.sql;
  const dayBook = (q: Record<string, unknown> = {}) =>
    service.dayBook({ companyId: COMPANY_ID, accYear: ACC_YEAR, fromDate: '2026-10-16', ...q });
  const noTender = (q: Record<string, unknown> = {}) =>
    service.noTender({ companyId: COMPANY_ID, accYear: ACC_YEAR, ...q });

  // ── the snapshot ──────────────────────────────────────────────────────────
  describe('the snapshot', () => {
    it('reads in one REPEATABLE READ, read-only transaction on custom plans', async () => {
      await dayBook();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][1]).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 10_000,
        timeout: 120_000,
      });
      const statements = tx.$executeRaw.mock.calls.map((args) => asSql(args).text.trim());
      expect(statements).toEqual([
        'SET TRANSACTION READ ONLY',
        'SET LOCAL plan_cache_mode = force_custom_plan',
      ]);
      // Both before the first read.
      expect(tx.$executeRaw.mock.invocationCallOrder[1]).toBeLessThan(
        tx.$queryRaw.mock.invocationCallOrder[0],
      );
    });
  });

  // ── rights ────────────────────────────────────────────────────────────────
  describe('rights', () => {
    it('asks user_menus for a VIEW of menu 284 or 181', async () => {
      await dayBook();

      expect(read('menu')!.values).toEqual([USER_ID, 284, 181]);
      expect(read('menu')!.text).toContain('um_can_view = true AND um_is_deleted = false');
    });

    it.each([
      ['a user with neither menu', () => (feed.menu = [])],
      ['no logged-in user', () => context.getUserId.mockReturnValue(null)],
      ['a user id that is not a uuid', () => context.getUserId.mockReturnValue('VKPOS')],
    ])('refuses %s with 403 NO_MENU_RIGHT before reading the books', async (_label, arrange) => {
      arrange();

      for (const call of [dayBook(), noTender()]) {
        const refusal = await refusalOf(call);
        expect(refusal).toEqual({
          status: 403,
          body: {
            success: false,
            message: 'No access to the Day Book by tender',
            errors: [
              {
                field: 'menu',
                code: TENDER_BOOKS_ERROR.NO_MENU_RIGHT,
                message:
                  'This user may not view menu 284 (Account Day Summary) or 181 (Day Book Detail).',
              },
            ],
          },
        });
      }
      expect(reads.some((r) => r.kind === 'year')).toBe(false);
    });

    it('does not ask user_menus at all for a caller with no uuid', async () => {
      context.getUserId.mockReturnValue(undefined);

      await refusalOf(dayBook());

      expect(reads.some((r) => r.kind === 'menu')).toBe(false);
    });
  });

  // ── the scope ─────────────────────────────────────────────────────────────
  describe('the scope', () => {
    const codeOf = (refusal: { body: unknown }) =>
      (refusal.body as { errors: { field: string; code: string; message: string }[] }).errors[0];

    it('wants a fromDate on the Day Book, checked after the right and before the year', async () => {
      const refusal = await refusalOf(dayBook({ fromDate: undefined }));

      expect(refusal.status).toBe(400);
      expect(codeOf(refusal)).toEqual({
        field: 'fromDate',
        code: TENDER_BOOKS_ERROR.DATE_REQUIRED,
        message: 'fromDate is required.',
      });
      expect(reads.map((r) => r.kind)).toEqual(['menu']);
    });

    it('refuses a year the company does not have', async () => {
      feed.year = [];

      const refusal = await refusalOf(dayBook());

      expect(read('year')!.values).toEqual([COMPANY_ID, ACC_YEAR]);
      expect(codeOf(refusal)).toEqual({
        field: 'accYear',
        code: TENDER_BOOKS_ERROR.YEAR_UNKNOWN,
        message: `No fiscal year ${ACC_YEAR} for this company.`,
      });
    });

    it.each([
      ['a branch that does not exist', []],
      ['a branch of another company', [{ br_comp_id: OTHER_COMPANY_ID }]],
      ['a branch with no company', [{ br_comp_id: null }]],
    ])('refuses %s', async (_label, branchRows) => {
      feed.branch = branchRows;

      const refusal = await refusalOf(dayBook({ branchId: BRANCH_ID }));

      expect(read('branch')!.values).toEqual([BRANCH_ID]);
      expect(codeOf(refusal)).toMatchObject({
        field: 'branchId',
        code: TENDER_BOOKS_ERROR.BRANCH_NOT_IN_COMPANY,
      });
    });

    it('reads no branch when none is asked for', async () => {
      await dayBook();

      expect(reads.some((r) => r.kind === 'branch')).toBe(false);
    });

    it('refuses a range that runs backwards', async () => {
      const refusal = await refusalOf(dayBook({ fromDate: '2026-10-16', toDate: '2026-10-15' }));

      expect(codeOf(refusal)).toEqual({
        field: 'fromDate',
        code: TENDER_BOOKS_ERROR.RANGE_REVERSED,
        message: '2026-10-16 is after 2026-10-15.',
      });
    });

    it.each([
      ['starts before the year', { fromDate: '2026-03-31', toDate: '2026-04-02' }, 'fromDate'],
      ['ends after the year', { fromDate: '2027-03-30', toDate: '2027-04-01' }, 'toDate'],
    ])('refuses a range that %s, on the end that is out', async (_label, range, field) => {
      const refusal = await refusalOf(dayBook(range));

      expect(codeOf(refusal)).toEqual({
        field,
        code: TENDER_BOOKS_ERROR.RANGE_OUTSIDE_YEAR,
        message: `${ACC_YEAR} runs 2026-04-01 to 2027-03-31; ${range.fromDate} – ${range.toDate} is outside it.`,
      });
    });

    it('accepts the first and last day of the year', async () => {
      await expect(
        dayBook({ fromDate: '2026-04-01', toDate: '2027-03-31' }),
      ).resolves.toMatchObject({ fromDate: '2026-04-01', toDate: '2027-03-31' });
    });

    it('reads one day on the Day Book when toDate is left out', async () => {
      await expect(dayBook({ fromDate: '2026-10-16' })).resolves.toMatchObject({
        fromDate: '2026-10-16',
        toDate: '2026-10-16',
      });
    });

    it('defaults the no-tender list to the year start through today', async () => {
      await expect(noTender()).resolves.toMatchObject({
        fromDate: '2026-04-01',
        toDate: '2026-10-21',
      });
    });

    it('stops the no-tender list at the year end once the year is over', async () => {
      feed.year = [{ begin: '2025-04-01', end: '2026-03-31', today: '2026-10-21' }];

      await expect(noTender({ accYear: '2025-2026' })).resolves.toMatchObject({
        fromDate: '2025-04-01',
        toDate: '2026-03-31',
      });
    });

    it('binds the dates as YYYY-MM-DD text, and the branch and session, into the lines', async () => {
      await dayBook({
        fromDate: '2026-10-10',
        toDate: '2026-10-16',
        branchId: BRANCH_ID,
        sessionId: SESSION_ID,
      });

      const values = read('rows')!.values;
      expect(values).toEqual(
        expect.arrayContaining([
          COMPANY_ID,
          ACC_YEAR,
          BRANCH_ID,
          SESSION_ID,
          '2026-10-16',
          '2026-10-10',
        ]),
      );
      expect(values.some((v) => v instanceof Date)).toBe(false);
      expect(read('rows')!.text).toContain('h.avh_voucher_date <= $');
    });

    it('binds null for every branch and every session', async () => {
      const result = await dayBook();

      expect(result.branchId).toBeNull();
      // branchId twice and sessionId twice in the lines' WHERE.
      expect(read('rows')!.values.filter((v) => v === null).length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── the Day Book: groups and ledgers ──────────────────────────────────────
  describe('dayBook', () => {
    beforeEach(() => {
      feed.agg = [
        agg({ opening: D('1000'), debit: D('250.10'), credit: D('100') }),
        agg({
          tender_id: UPI_TENDER,
          tender_name: 'UPI',
          tender_type_id: 4,
          tender_type_name: 'UPI',
          opening: D('0.1'),
          debit: D('0.2'),
          credit: D('0'),
        }),
        // Lines no tender row labels.
        agg({
          tender_id: null,
          tender_name: null,
          tender_type_id: null,
          tender_type_name: null,
          opening: D('-5'),
          debit: D('30'),
          credit: D('12.5'),
        }),
        agg({
          ledger_id: BANK_LEDGER,
          ledger_name: 'KVB Current',
          ledger_type: 'BANK',
          tender_id: UPI_TENDER,
          tender_name: 'UPI',
          tender_type_id: 4,
          tender_type_name: 'UPI',
          opening: D('500'),
          debit: D('0'),
          credit: D('75'),
        }),
      ];
      feed.sets = [{ ledger_id: CASH_LEDGER, amt: D('2000') }];
    });

    it('reports each ledger × tender with its opening, movement and closing', async () => {
      const { groups } = await dayBook();

      expect(groups).toEqual([
        {
          key: `${CASH_LEDGER}|${CASH_TENDER}`,
          tenderId: CASH_TENDER,
          tenderName: 'CASH',
          tenderTypeId: 1,
          tenderTypeName: 'Cash',
          ledgerId: CASH_LEDGER,
          ledgerName: 'Cash in Hand',
          ledgerType: 'CASH',
          opening: '1000.00',
          debit: '250.10',
          credit: '100.00',
          closing: '1150.10',
        },
        expect.objectContaining({
          key: `${CASH_LEDGER}|${UPI_TENDER}`,
          opening: '0.10',
          debit: '0.20',
          closing: '0.30',
        }),
        expect.objectContaining({
          key: `${CASH_LEDGER}|NONE`,
          tenderId: null,
          tenderTypeId: null,
          opening: '-5.00',
          closing: '12.50',
        }),
        expect.objectContaining({ key: `${BANK_LEDGER}|${UPI_TENDER}`, closing: '425.00' }),
      ]);
    });

    it('books each ledger whole: opening set + every group, with its no-tender lines', async () => {
      const { ledgers } = await dayBook();

      expect(ledgers).toEqual([
        {
          ledgerId: CASH_LEDGER,
          ledgerName: 'Cash in Hand',
          ledgerType: 'CASH',
          openingSet: '2000.00',
          // 2000 + 1000 + 0.1 − 5
          opening: '2995.10',
          // 250.10 + 0.2 + 30
          debit: '280.30',
          // 100 + 0 + 12.5
          credit: '112.50',
          closing: '3162.90',
          // debit + credit of the no-tender group
          noTender: '42.50',
        },
        {
          ledgerId: BANK_LEDGER,
          ledgerName: 'KVB Current',
          ledgerType: 'BANK',
          openingSet: '0.00',
          opening: '500.00',
          debit: '0.00',
          credit: '75.00',
          closing: '425.00',
          noTender: '0.00',
        },
      ]);
    });

    it('asks for the opening sets of exactly the ledgers it saw', async () => {
      await dayBook({ branchId: BRANCH_ID });

      expect(read('sets')!.values).toEqual([
        COMPANY_ID,
        [CASH_LEDGER, BANK_LEDGER],
        ACC_YEAR,
        BRANCH_ID,
        BRANCH_ID,
      ]);
    });

    it('reads no opening set when no money moved', async () => {
      feed.agg = [];

      const result = await dayBook();

      expect(reads.some((r) => r.kind === 'sets')).toBe(false);
      expect(result).toMatchObject({ groups: [], ledgers: [] });
    });

    it('splits the year at fromDate: the lines from the start of the year, opening before fromDate', async () => {
      await dayBook({ fromDate: '2026-10-10', toDate: '2026-10-16' });

      const sql = read('agg')!;
      expect(sql.text).toContain('FILTER (WHERE x.voucher_date < $');
      // The lines are the whole year up to toDate: their own `from` is null.
      expect(sql.values).toEqual(expect.arrayContaining([null, '2026-10-16', '2026-10-10', false]));
    });

    it('groups by tender type on request, keying by the type', async () => {
      feed.agg = [
        agg({
          tender_id: null,
          tender_type_id: 4,
          tender_type_name: 'UPI',
          debit: D('10'),
        }),
        agg({ tender_id: null, tender_name: null, tender_type_id: null, credit: D('3') }),
      ];

      const result = await dayBook({ groupBy: 'TYPE' });

      expect(read('agg')!.values).toContain(true);
      expect(result.groupBy).toBe('TYPE');
      expect(result.groups.map((g) => g.key)).toEqual([`${CASH_LEDGER}|4`, `${CASH_LEDGER}|NONE`]);
    });

    it('defaults to grouping by tender', async () => {
      await expect(dayBook()).resolves.toMatchObject({ groupBy: 'TENDER' });
    });

    it.each([
      ['tender masters', { tenderIds: [UPI_TENDER] }],
      ['tender types', { tenderTypeIds: ['4'] }],
    ])(
      'narrows the groups to the %s asked for, but keeps every ledger whole',
      async (_l, filter) => {
        const result = await dayBook(filter);

        expect(result.groups.map((g) => g.key)).toEqual([
          `${CASH_LEDGER}|${UPI_TENDER}`,
          `${BANK_LEDGER}|${UPI_TENDER}`,
        ]);
        expect(result.ledgers.find((l) => l.ledgerId === CASH_LEDGER)).toMatchObject({
          closing: '3162.90',
          noTender: '42.50',
        });
      },
    );
  });

  // ── the Day Book: the lines ───────────────────────────────────────────────
  describe('dayBook rows', () => {
    it('lists the range line by line, a DR as debit and a CR as credit', async () => {
      feed.lines = [
        line(),
        line({
          side: 'CR',
          amount: D('40'),
          party_id: CASH_LEDGER,
          party_name: 'Ravi',
          session_id: SESSION_ID,
          is_mirror: true,
        }),
      ];

      const { rows, rowsTruncated } = await dayBook();

      expect(rows).toEqual([
        {
          voucherDate: '2026-10-16',
          voucherId: VOUCHER_ID,
          accYear: ACC_YEAR,
          voucherNo: 'RCV00140',
          voucherTypeId: 7,
          voucherTypeCode: 'RcpV',
          branchId: BRANCH_ID,
          sessionId: null,
          partyId: null,
          partyName: null,
          ledgerId: CASH_LEDGER,
          ledgerName: 'Cash in Hand',
          ledgerType: 'CASH',
          tenderId: CASH_TENDER,
          tenderName: 'CASH',
          tenderTypeId: 1,
          tenderTypeName: 'Cash',
          isMirror: false,
          debit: '100.50',
          credit: '0.00',
        },
        expect.objectContaining({
          debit: '0.00',
          credit: '40.00',
          isMirror: true,
          partyName: 'Ravi',
          sessionId: SESSION_ID,
        }),
      ]);
      expect(rowsTruncated).toBe(false);
    });

    it('asks for one row past the cap of 5000 by default, every tender included', async () => {
      await dayBook();

      expect(read('rows')!.values.slice(-2)).toEqual([false, 5001]);
      expect(read('rows')!.text).toContain('ORDER BY x.voucher_date, x.refno NULLS LAST');
    });

    it('caps the rows at the limit and says so', async () => {
      feed.lines = [line(), line(), line()];

      const result = await dayBook({ limit: 2 });

      expect(read('rows')!.values.slice(-1)).toEqual([3]);
      expect(result.rows).toHaveLength(2);
      expect(result.rowsTruncated).toBe(true);
    });

    it('is not truncated at exactly the cap', async () => {
      feed.lines = [line(), line()];

      await expect(dayBook({ limit: 2 })).resolves.toMatchObject({ rowsTruncated: false });
    });

    it('keeps only the lines of the tenders asked for', async () => {
      feed.lines = [
        line(),
        line({ tender_id: UPI_TENDER, tender_type_id: 4 }),
        line({ tender_id: null, tender_type_id: null }),
      ];

      const result = await dayBook({ tenderIds: [UPI_TENDER] });

      expect(result.rows.map((r) => r.tenderId)).toEqual([UPI_TENDER]);
    });

    it('reads no lines when withRows is false', async () => {
      feed.lines = [line()];

      const result = await dayBook({ withRows: false });

      expect(reads.some((r) => r.kind === 'rows')).toBe(false);
      expect(result).toMatchObject({ rows: [], rowsTruncated: false });
    });
  });

  // ── the money lines with no tender ────────────────────────────────────────
  describe('noTender', () => {
    it('counts the lines per voucher type and lists them, no-tender lines only', async () => {
      feed.byType = [
        { code: 'TDrp', n: 120, amt: D('5000.10') },
        { code: 'Rev', n: 36, amt: D('0.2') },
        { code: null, n: 1, amt: D('99.7') },
      ];
      feed.lines = [line(), line({ tender_id: null, tender_type_id: null, refno: 'TDRP001' })];

      const result = await noTender({ branchId: BRANCH_ID, fromDate: '2026-10-01' });

      expect(result).toEqual({
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        branchId: BRANCH_ID,
        fromDate: '2026-10-01',
        toDate: '2026-10-21',
        count: 157,
        amount: '5100.00',
        byVoucherType: [
          { voucherTypeCode: 'TDrp', count: 120, amount: '5000.10' },
          { voucherTypeCode: 'Rev', count: 36, amount: '0.20' },
          { voucherTypeCode: null, count: 1, amount: '99.70' },
        ],
        rows: [expect.objectContaining({ voucherNo: 'TDRP001', tenderId: null })],
        rowsTruncated: false,
      });
      expect(read('byType')!.text).toContain('WHERE x.tender_id IS NULL');
      expect(read('rows')!.values.slice(-2)).toEqual([true, 5001]);
    });

    it('reads the lines from fromDate, not from the year start', async () => {
      await noTender({ fromDate: '2026-10-01', toDate: '2026-10-05' });

      expect(read('byType')!.values).toEqual(expect.arrayContaining(['2026-10-05', '2026-10-01']));
    });

    it('answers 0 and 0.00 when every money line has its tender', async () => {
      await expect(noTender()).resolves.toMatchObject({
        count: 0,
        amount: '0.00',
        byVoucherType: [],
        rows: [],
        rowsTruncated: false,
      });
    });

    it('caps the listed lines at the limit and says so', async () => {
      feed.lines = [
        line({ tender_id: null }),
        line({ tender_id: null }),
        line({ tender_id: null }),
      ];

      const result = await noTender({ limit: 2 });

      expect(result.rows).toHaveLength(2);
      expect(result.rowsTruncated).toBe(true);
    });
  });
});
