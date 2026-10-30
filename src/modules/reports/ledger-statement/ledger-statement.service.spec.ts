import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { LedgerStatementService } from './ledger-statement.service';
import { LEDGER_STATEMENT_ERROR } from './types/ledger-statement.types';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b101';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b102';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b103';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b104';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46b105';
const CASH_ID = '019c6f6c-be87-7a11-8905-36092c46b106';
const SALES_ID = '019c6f6c-be87-7a11-8905-36092c46b107';
const GST_ID = '019c6f6c-be87-7a11-8905-36092c46b108';
const V1 = '019c6f6c-be87-7a11-8905-36092c46b111';
const V2 = '019c6f6c-be87-7a11-8905-36092c46b112';
const V3 = '019c6f6c-be87-7a11-8905-36092c46b113';
const YEAR = '2026-2027';

const D = (value: string | number) => new Prisma.Decimal(value);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// ── a fake $queryRaw that answers each statement by its SQL text ───────────

type Rows = unknown[];
type Handler = jest.Mock<Rows, [{ text: string; values: unknown[] }]>;

/** Ordered: the first predicate that matches the statement answers it. */
const ROUTES: Array<[string, (text: string) => boolean]> = [
  ['menu', (t) => t.includes('FROM public.user_menus')],
  ['fiscalYear', (t) => t.includes('FROM public.fiscal_years')],
  ['ledgerCompany', (t) => t.includes('SELECT led_company_id FROM accounts.acc_ledger_master')],
  ['branch', (t) => t.includes('FROM public.branch_master WHERE br_id')],
  ['picker', (t) => t.includes('ORDER BY l.led_name, l.led_id')],
  ['facts', (t) => t.includes('c.cus_credit_amt_limit')],
  ['voucherHeader', (t) => t.includes('avh_voucher_refno AS refno, avh_voucher_date AS vdate')],
  ['legs', (t) => t.includes('v.av_row_no AS row_no')],
  ['billRefs', (t) => t.includes('accounts.acc_bill_adjustment')],
  ['core', (t) => t.includes('COUNT(*) OVER () AS total_rows')],
  ['pairs', (t) => t.includes("WHERE kind = 'CANCELLED' AND pair_inside")],
  ['countRows', (t) => t.includes('SELECT COUNT(*) AS n FROM k')],
  ['totals', (t) => t.includes('AS dr_n')],
  ['openingOf', (t) => t.includes('AS branch_rows')],
  ['daily', (t) => t.includes('GROUP BY av_voucher_date')],
  ['monthly', (t) => t.includes("to_char(av_voucher_date, 'YYYY-MM')")],
];

const makeDb = () => {
  const handlers = Object.fromEntries(
    ROUTES.map(([name]) => [name, jest.fn().mockReturnValue([])]),
  ) as Record<string, Handler>;
  const $queryRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = Prisma.sql(strings, ...values);
    const text = sql.sql.replace(/\s+/g, ' ');
    const route = ROUTES.find(([, matches]) => matches(text));
    if (!route) throw new Error(`unrouted statement: ${text.slice(0, 120)}`);
    return handlers[route[0]]({ text, values: sql.values });
  });
  return { handlers, prisma: { $queryRaw } };
};

/** The bound values of the n-th call a route answered. */
const valuesOf = (handler: Handler, call = 0) => handler.mock.calls[call][0].values;
const textOfCall = (handler: Handler, call = 0) => handler.mock.calls[call][0].text;

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

const scope = { companyId: COMPANY_ID, accYear: YEAR, ledgerId: LEDGER_ID };
const range = { ...scope, fromDate: '2026-08-01', toDate: '2026-09-25' };

const coreRow = (overrides: Record<string, unknown> = {}) => ({
  vid: V1,
  vyr: YEAR,
  vdate: day('2026-08-05'),
  dr: D('1180'),
  cr: D(0),
  net: D('1180'),
  status: 'POSTED',
  kind: 'NORMAL',
  pair_inside: false,
  running: D('6180'),
  total_rows: 3n,
  branch_id: BRANCH_ID,
  branch_name: 'Main',
  vtype_id: 7,
  vtype_name: 'Sales',
  vtype_short: 'SB',
  refno: 'SB00012',
  remarks: null,
  usr_refno: null,
  created_by: USER_ID,
  created_by_name: 'cashier1',
  src_module: 'SALES',
  src_doc_type: 'SALE_BILL',
  src_doc_id: 'doc-1',
  ...overrides,
});

const legRow = (overrides: Record<string, unknown> = {}) => ({
  vid: V1,
  vyr: YEAR,
  row_no: 1,
  dr_cr: 'DR',
  ledger_id: LEDGER_ID,
  ledger_name: 'Ravi Stores',
  amount: D('1180'),
  role: 'PARTY',
  remarks: null,
  opp_ledger_id: null,
  opp_ledger_name: null,
  ...overrides,
});

describe('LedgerStatementService', () => {
  let db: ReturnType<typeof makeDb>;
  let context: { getUserId: jest.Mock };
  let service: LedgerStatementService;

  beforeEach(() => {
    db = makeDb();
    const h = db.handlers;
    h.menu.mockReturnValue([{ ok: true }]);
    h.fiscalYear.mockReturnValue([
      {
        fy_begin_date: day('2026-04-01'),
        fy_end_date: day('2027-03-31'),
        fy_books_begin_date: null,
      },
    ]);
    h.ledgerCompany.mockReturnValue([{ led_company_id: COMPANY_ID }]);
    h.branch.mockReturnValue([{ br_comp_id: COMPANY_ID }]);
    h.totals.mockReturnValue([
      { op: D('5000'), before: D(0), dr: D('1180'), cr: D('500'), dr_n: 1n, cr_n: 1n },
    ]);
    h.openingOf.mockReturnValue([{ amt: D('5000'), branch_rows: 0n, company_rows: 1n }]);
    h.pairs.mockReturnValue([{ n: 0n }]);
    h.countRows.mockReturnValue([{ n: 0n }]);
    h.facts.mockReturnValue([
      {
        led_id: LEDGER_ID,
        led_name: 'Ravi Stores',
        acc_group_name: 'Sundry Debtors',
        acc_group_nature: 'ASSET',
        led_is_bill_by_bill: true,
        led_gstin_no: ' 32AAAAA0000A1Z5 ',
        led_phone1: '  ',
        led_whatsapp_no: '9847000000',
        cus_credit_days: 30,
        cus_credit_amt_limit: D('50000'),
        sup_credit_days: null,
      },
    ]);
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new LedgerStatementService(db.prisma as unknown as PrismaService, context as never);
  });

  // ── the menu right ────────────────────────────────────────────────────────
  describe('the menu right', () => {
    const routes: Array<[string, () => Promise<unknown>]> = [
      ['ledgers', () => service.ledgers({ companyId: COMPANY_ID })],
      ['header', () => service.header(range)],
      ['vouchers', () => service.vouchers(range)],
      [
        'voucherLegs',
        () =>
          service.voucherLegs({
            companyId: COMPANY_ID,
            accYear: YEAR,
            voucherId: V1,
            ledgerId: LEDGER_ID,
          }),
      ],
      ['daily', () => service.daily(range)],
      ['monthly', () => service.monthly(scope)],
      ['export', () => service.export(range)],
    ];

    it('asks whether the caller may view menu 258 or 144', async () => {
      await service.ledgers({ companyId: COMPANY_ID });

      expect(textOfCall(db.handlers.menu)).toContain(
        'um_can_view = true AND um_is_deleted = false',
      );
      expect(valuesOf(db.handlers.menu)).toEqual([USER_ID, 258, 144]);
    });

    it.each(routes)(
      'refuses %s with 403 NO_MENU_RIGHT before reading anything',
      async (_n, call) => {
        db.handlers.menu.mockReturnValue([]);

        const refusal = await refusalOf(call());

        expect(refusal).toEqual({
          status: 403,
          body: {
            success: false,
            message: 'No access to the Ledger Statement',
            errors: [
              {
                field: 'menu',
                code: LEDGER_STATEMENT_ERROR.NO_MENU_RIGHT,
                message:
                  'This user may not view menu 258 (Ledger Statement) or 144 (Ledger Monthly Summary).',
              },
            ],
          },
        });
        expect(db.prisma.$queryRaw).toHaveBeenCalledTimes(1);
      },
    );

    it.each([
      ['no logged-in user', null],
      ['a user id that is not a uuid', 'VKPOS'],
    ])('refuses %s without asking the database', async (_label, userId) => {
      context.getUserId.mockReturnValue(userId);

      const refusal = await refusalOf(service.header(range));

      expect(refusal.status).toBe(403);
      expect(db.prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ── the scope and the range (§9) ──────────────────────────────────────────
  describe('the scope and the range', () => {
    const codeOf = (refusal: { body: unknown }) =>
      (refusal.body as { errors: { code: string; field: string }[] }).errors[0];

    it('refuses a year the company does not have, before looking at the ledger', async () => {
      db.handlers.fiscalYear.mockReturnValue([]);

      const refusal = await refusalOf(service.header(range));

      expect(refusal).toEqual({
        status: 400,
        body: {
          success: false,
          message: 'Ledger statement request refused',
          errors: [
            {
              field: 'accYear',
              message: `No fiscal year ${YEAR} for this company.`,
              code: LEDGER_STATEMENT_ERROR.YEAR_UNKNOWN,
            },
          ],
        },
      });
      expect(valuesOf(db.handlers.fiscalYear)).toEqual([COMPANY_ID, YEAR]);
      expect(db.handlers.ledgerCompany).not.toHaveBeenCalled();
    });

    it('answers 404 for a ledger that is not live', async () => {
      db.handlers.ledgerCompany.mockReturnValue([]);

      const refusal = await refusalOf(service.header(range));

      expect(refusal.status).toBe(404);
      expect(codeOf(refusal)).toEqual({
        field: 'ledgerId',
        code: LEDGER_STATEMENT_ERROR.LEDGER_NOT_FOUND,
        message: `No live ledger ${LEDGER_ID}`,
      });
    });

    it("refuses another company's ledger but reads a shared one", async () => {
      db.handlers.ledgerCompany.mockReturnValueOnce([{ led_company_id: OTHER_COMPANY_ID }]);
      const refusal = await refusalOf(service.header(range));

      db.handlers.ledgerCompany.mockReturnValueOnce([{ led_company_id: null }]);
      await expect(service.header(range)).resolves.toBeDefined();

      expect(refusal.status).toBe(400);
      expect(codeOf(refusal).code).toBe(LEDGER_STATEMENT_ERROR.LEDGER_NOT_IN_COMPANY);
    });

    it.each([
      ['a branch that does not exist', []],
      ['a branch of another company', [{ br_comp_id: OTHER_COMPANY_ID }]],
    ])('refuses %s', async (_label, rows) => {
      db.handlers.branch.mockReturnValue(rows);

      const refusal = await refusalOf(service.header({ ...range, branchId: BRANCH_ID }));

      expect(refusal.status).toBe(400);
      expect(codeOf(refusal)).toMatchObject({
        field: 'branchId',
        code: LEDGER_STATEMENT_ERROR.BRANCH_NOT_IN_COMPANY,
      });
    });

    it('looks no branch up for All branches', async () => {
      await service.header(range);

      expect(db.handlers.branch).not.toHaveBeenCalled();
    });

    it('refuses a reversed range on fromDate', async () => {
      const refusal = await refusalOf(
        service.header({ ...range, fromDate: '2026-09-25', toDate: '2026-08-01' }),
      );

      expect(codeOf(refusal)).toEqual({
        field: 'fromDate',
        code: LEDGER_STATEMENT_ERROR.RANGE_REVERSED,
        message: '2026-09-25 is after 2026-08-01.',
      });
      expect(db.handlers.totals).not.toHaveBeenCalled();
    });

    it.each([
      ['starts before the year', '2026-03-31', '2026-04-30', 'fromDate'],
      ['ends after the year', '2027-03-01', '2027-04-01', 'toDate'],
    ])('refuses a range that %s, on the end that is out', async (_label, from, to, field) => {
      const refusal = await refusalOf(service.header({ ...range, fromDate: from, toDate: to }));

      expect(codeOf(refusal)).toEqual({
        field,
        code: LEDGER_STATEMENT_ERROR.RANGE_OUTSIDE_YEAR,
        message: `${YEAR} runs 2026-04-01 to 2027-03-31; ${from} – ${to} is outside it.`,
      });
    });

    it('accepts the whole fiscal year, first day to last', async () => {
      await expect(
        service.header({ ...range, fromDate: '2026-04-01', toDate: '2027-03-31' }),
      ).resolves.toBeDefined();
    });
  });

  // ── the picker ────────────────────────────────────────────────────────────
  describe('ledgers', () => {
    it('lists live ledgers of the company and shared ones, 30 by default', async () => {
      db.handlers.picker.mockReturnValue([
        {
          led_id: LEDGER_ID,
          led_name: 'Ravi Stores',
          led_group_id: 'g1',
          acc_group_name: 'Sundry Debtors',
          led_is_bill_by_bill: true,
          led_company_id: COMPANY_ID,
        },
        {
          led_id: CASH_ID,
          led_name: 'Cash',
          led_group_id: null,
          acc_group_name: null,
          led_is_bill_by_bill: null,
          led_company_id: null,
        },
      ]);

      await expect(service.ledgers({ companyId: COMPANY_ID })).resolves.toEqual({
        items: [
          {
            ledgerId: LEDGER_ID,
            name: 'Ravi Stores',
            groupId: 'g1',
            groupName: 'Sundry Debtors',
            isBillByBill: true,
            isShared: false,
            isDeleted: false,
          },
          {
            ledgerId: CASH_ID,
            name: 'Cash',
            groupId: null,
            groupName: null,
            isBillByBill: false,
            isShared: true,
            isDeleted: false,
          },
        ],
      });
      const text = textOfCall(db.handlers.picker);
      expect(text).toContain('(l.led_company_id IS NULL OR l.led_company_id = ?::uuid)');
      expect(text).toContain('AND TRUE ORDER BY');
      // false = includeDeleted left out: deleted ledgers stay hidden.
      expect(text).toContain('(l.led_is_deleted = false OR ?)');
      expect(valuesOf(db.handlers.picker)).toEqual([false, COMPANY_ID, null, null, 30]);
    });

    it('lists deleted ledgers too with includeDeleted, flagged isDeleted (D1-7)', async () => {
      await service.ledgers({ companyId: COMPANY_ID, includeDeleted: true });

      expect(valuesOf(db.handlers.picker)[0]).toBe(true);
    });

    it('narrows by group and searches five columns for every word, up to the limit given', async () => {
      await service.ledgers({
        companyId: COMPANY_ID,
        groupId: 'g1',
        search: 'ravi 9847',
        limit: 5,
      });

      const text = textOfCall(db.handlers.picker);
      expect(text).toContain('l.led_gstin_no');
      expect(text).toContain('l.led_phone1');
      expect(text).toMatch(/\) AND \(/);
      expect(valuesOf(db.handlers.picker)).toEqual(
        expect.arrayContaining(['g1', 'ravi', '9847', 5]),
      );
    });
  });

  // ── header ────────────────────────────────────────────────────────────────
  describe('header', () => {
    it('answers the ledger detail and the period, the balance exact to the paisa', async () => {
      db.handlers.totals.mockReturnValue([
        {
          op: D('12345678901234.56'),
          before: D('-0.01'),
          dr: D('1180.10'),
          cr: D('500.05'),
          dr_n: 3n,
          cr_n: 2n,
        },
      ]);
      db.handlers.pairs.mockReturnValue([{ n: 1n }]);

      await expect(service.header(range)).resolves.toEqual({
        ledger: {
          ledgerId: LEDGER_ID,
          name: 'Ravi Stores',
          isDeleted: false,
          groupName: 'Sundry Debtors',
          nature: 'ASSET',
          isBillByBill: true,
          gstin: '32AAAAA0000A1Z5',
          mobile: '9847000000',
          creditDays: 30,
          creditLimit: '50000.00',
        },
        period: {
          fromDate: '2026-08-01',
          toDate: '2026-09-25',
          opening: { amount: '12345678901234.55', side: 'DR' },
          debit: { amount: '1180.10', vouchers: 3 },
          credit: { amount: '500.05', vouchers: 2 },
          closing: { amount: '12345678901914.60', side: 'DR' },
          cancelledPairs: 1,
          openingNote: null,
        },
      });
    });

    it('binds the period as YYYY-MM-DD text, never as a JS Date', async () => {
      await service.header(range);

      const values = valuesOf(db.handlers.totals);
      expect(values).toEqual(
        expect.arrayContaining([COMPANY_ID, LEDGER_ID, YEAR, '2026-08-01', '2026-09-25']),
      );
      expect(values.some((value) => value instanceof Date)).toBe(false);
      expect(textOfCall(db.handlers.totals)).toContain('av_voucher_date < ?::date');
    });

    it('shows a balance that went credit as CR, never with a minus sign', async () => {
      db.handlers.totals.mockReturnValue([
        { op: D('-200'), before: D(0), dr: D(0), cr: D('300'), dr_n: 0n, cr_n: 1n },
      ]);

      const { period } = await service.header(range);

      expect(period.opening).toEqual({ amount: '200.00', side: 'CR' });
      expect(period.closing).toEqual({ amount: '500.00', side: 'CR' });
    });

    it.each([
      ['a branch view of a company-level-only opening', BRANCH_ID, 0n, 2n, 'COMPANY_LEVEL_ONLY'],
      ['a branch with an opening of its own', BRANCH_ID, 1n, 2n, null],
      ['All branches', undefined, 0n, 2n, null],
    ])('notes %s', async (_label, branchId, branchRows, companyRows, note) => {
      db.handlers.openingOf.mockReturnValue([
        { amt: D(0), branch_rows: branchRows, company_rows: companyRows },
      ]);

      const { period } = await service.header({ ...range, branchId });

      expect(period.openingNote).toBe(note);
    });

    it('describes a supplier and a plain ledger by what they have', async () => {
      db.handlers.facts.mockReturnValueOnce([
        {
          led_id: LEDGER_ID,
          led_name: 'Acme Supplies',
          acc_group_name: null,
          acc_group_nature: null,
          led_is_bill_by_bill: null,
          led_gstin_no: '   ',
          led_phone1: ' 0484 ',
          led_whatsapp_no: null,
          cus_credit_days: null,
          cus_credit_amt_limit: null,
          sup_credit_days: 45,
        },
      ]);

      const { ledger } = await service.header(range);

      expect(ledger).toMatchObject({
        isBillByBill: false,
        gstin: null,
        mobile: '0484',
        creditDays: 45,
        creditLimit: null,
      });
    });

    it('counts the cancelled pairs with both halves inside the period', async () => {
      await service.header(range);

      const text = textOfCall(db.handlers.pairs);
      expect(text).toContain("CASE WHEN hk.status = 'CANCELLED' THEN 'CANCELLED'");
      expect(text).toContain("WHEN hk.orig_id IS NOT NULL THEN 'REVERSAL'");
    });
  });

  // ── vouchers ──────────────────────────────────────────────────────────────
  describe('vouchers', () => {
    it('pages 200 rows from the first, keeping cancelled pairs, by default', async () => {
      await service.vouchers(range);

      const values = valuesOf(db.handlers.core);
      expect(values.slice(-3)).toEqual([true, 200, 0]);
      expect(textOfCall(db.handlers.core)).toContain('LIMIT ? OFFSET ?');
    });

    it('skips the earlier pages and hides cancelled pairs when asked', async () => {
      await service.vouchers({ ...range, page: 3, pageSize: 50, includeCancelled: false });

      expect(valuesOf(db.handlers.core).slice(-3)).toEqual([false, 50, 100]);
    });

    it('decorates each row with its particulars, narration, bill refs and running balance', async () => {
      db.handlers.core.mockReturnValue([
        coreRow({ remarks: '  ', usr_refno: ' INV-77 ', created_by_name: null }),
      ]);
      db.handlers.legs.mockReturnValue([
        legRow(),
        legRow({
          row_no: 2,
          dr_cr: 'CR',
          ledger_id: SALES_ID,
          ledger_name: 'Sales',
          amount: D('1000'),
        }),
        legRow({
          row_no: 3,
          dr_cr: 'CR',
          ledger_id: GST_ID,
          ledger_name: 'Output GST',
          amount: D('180'),
        }),
      ]);
      db.handlers.billRefs.mockReturnValue([
        { vid: V1, vyr: YEAR, ref: 'SB00012', due: day('2026-09-04'), raised: true },
      ]);

      const result = await service.vouchers(range);

      expect(result.rows).toEqual([
        {
          voucherId: V1,
          accYear: YEAR,
          branchId: BRANCH_ID,
          branchName: 'Main',
          date: '2026-08-05',
          voucherTypeId: 7,
          voucherTypeName: 'Sales',
          voucherTypeShort: 'SB',
          voucherNo: 'SB00012',
          status: 'POSTED',
          rowKind: 'NORMAL',
          pairOutsideRange: false,
          particulars: null,
          asPerDetails: true,
          legCount: 3,
          narration: 'INV-77',
          billRefs: ['SB00012 due 04-09'],
          debit: '1180.00',
          credit: '0.00',
          balance: { amount: '6180.00', side: 'DR' },
          createdBy: USER_ID,
          src: { module: 'SALES', docType: 'SALE_BILL', docId: 'doc-1' },
        },
      ]);
      expect(result.page).toEqual({ page: 1, pageSize: 200, totalRows: 3 });
    });

    it('brings forward the balance before the first row and carries the last row’s', async () => {
      db.handlers.core.mockReturnValue([
        coreRow({ vid: V1, net: D('1180'), running: D('6180') }),
        coreRow({ vid: V2, net: D('-500'), running: D('5680') }),
      ]);

      const result = await service.vouchers(range);

      expect(result.broughtForward).toEqual({ amount: '5000.00', side: 'DR' });
      expect(result.carriedForward).toEqual({ amount: '5680.00', side: 'DR' });
    });

    it.each([
      ['page 1 of an empty range brings and carries the opening', 1, '5000.00'],
      ['a page past the end brings and carries the closing', 4, '5680.00'],
    ])('%s', async (_label, page, amount) => {
      db.handlers.countRows.mockReturnValue([{ n: 2n }]);

      const result = await service.vouchers({ ...range, page });

      expect(result.rows).toEqual([]);
      expect(result.broughtForward).toEqual({ amount, side: 'DR' });
      expect(result.carriedForward).toEqual({ amount, side: 'DR' });
      expect(result.page.totalRows).toBe(2);
      expect(db.handlers.legs).not.toHaveBeenCalled();
    });

    it('counts a page past the end with the same cancelled-pair filter', async () => {
      await service.vouchers({ ...range, page: 9, includeCancelled: false });

      expect(textOfCall(db.handlers.countRows)).toContain(
        "NOT (k.kind <> 'NORMAL' AND k.pair_inside)",
      );
      expect(valuesOf(db.handlers.countRows).at(-1)).toBe(false);
    });

    it('marks a lone half of a cancel pair as reaching outside the range', async () => {
      db.handlers.core.mockReturnValue([
        coreRow({ kind: 'CANCELLED', status: 'CANCELLED', pair_inside: false }),
        coreRow({ vid: V2, kind: 'REVERSAL', pair_inside: true }),
      ]);

      const { rows } = await service.vouchers(range);

      expect(rows.map((row) => [row.rowKind, row.pairOutsideRange])).toEqual([
        ['CANCELLED', true],
        ['REVERSAL', false],
      ]);
    });

    it('reads no bill refs when told not to, and inlines the legs when asked', async () => {
      db.handlers.core.mockReturnValue([coreRow()]);
      db.handlers.legs.mockReturnValue([
        legRow(),
        legRow({ row_no: 2, dr_cr: 'CR ', ledger_id: CASH_ID, ledger_name: 'Cash' }),
      ]);

      const { rows } = await service.vouchers({ ...range, withBillRefs: false, withLegs: true });

      expect(db.handlers.billRefs).not.toHaveBeenCalled();
      expect(rows[0].billRefs).toEqual([]);
      expect(rows[0].legs).toEqual([
        {
          rowNo: 1,
          side: 'DR',
          ledgerId: LEDGER_ID,
          ledgerName: 'Ravi Stores',
          amount: '1180.00',
          role: 'PARTY',
          isThisLedger: true,
          remarks: null,
        },
        expect.objectContaining({ rowNo: 2, side: 'CR', ledgerId: CASH_ID, isThisLedger: false }),
      ]);
    });

    it('leaves the legs out of a row unless asked', async () => {
      db.handlers.core.mockReturnValue([coreRow()]);

      const { rows } = await service.vouchers(range);

      expect(rows[0]).not.toHaveProperty('legs');
    });

    it('reads the legs of every row on the page in one statement', async () => {
      db.handlers.core.mockReturnValue([coreRow({ vid: V1 }), coreRow({ vid: V2 })]);

      await service.vouchers(range);

      expect(db.handlers.legs).toHaveBeenCalledTimes(1);
      expect(valuesOf(db.handlers.legs)).toEqual([V1, YEAR, V2, YEAR]);
    });
  });

  // ── particulars (§8) ──────────────────────────────────────────────────────
  describe('particulars', () => {
    const particularsFor = async (legs: Record<string, unknown>[]) => {
      db.handlers.core.mockReturnValue([coreRow()]);
      db.handlers.legs.mockReturnValue(legs.map((leg) => legRow(leg)));
      const { rows } = await service.vouchers(range);
      return [rows[0].particulars, rows[0].asPerDetails];
    };

    it('names the opposite ledger every one of this ledger’s legs points at', async () => {
      await expect(
        particularsFor([
          { opp_ledger_id: CASH_ID, opp_ledger_name: 'Cash' },
          { row_no: 2, opp_ledger_id: CASH_ID, opp_ledger_name: 'Cash' },
          { row_no: 3, dr_cr: 'CR', ledger_id: CASH_ID, ledger_name: 'Cash' },
        ]),
      ).resolves.toEqual(['Cash', false]);
    });

    it('names the one ledger on the opposite side when the legs name none', async () => {
      await expect(
        particularsFor([
          {},
          { row_no: 2, dr_cr: 'CR ', ledger_id: SALES_ID, ledger_name: 'Sales' },
          { row_no: 3, dr_cr: 'CR', ledger_id: SALES_ID, ledger_name: 'Sales' },
        ]),
      ).resolves.toEqual(['Sales', false]);
    });

    it.each([
      [
        'two ledgers on the opposite side',
        [
          {},
          { row_no: 2, dr_cr: 'CR', ledger_id: SALES_ID, ledger_name: 'Sales' },
          { row_no: 3, dr_cr: 'CR', ledger_id: GST_ID, ledger_name: 'Output GST' },
        ],
      ],
      [
        'this ledger on both sides',
        [
          {},
          { row_no: 2, dr_cr: 'CR' },
          { row_no: 3, dr_cr: 'CR', ledger_id: CASH_ID, ledger_name: 'Cash' },
        ],
      ],
      ['no leg of this ledger at all', [{ ledger_id: CASH_ID }]],
    ])('says "as per details" for %s', async (_label, legs) => {
      await expect(particularsFor(legs)).resolves.toEqual([null, true]);
    });
  });

  // ── bill refs (§8) ────────────────────────────────────────────────────────
  describe('bill refs', () => {
    it('lists each bill once, settled ones bare and the raised one with its due date', async () => {
      db.handlers.core.mockReturnValue([coreRow({ vid: V1 }), coreRow({ vid: V3 })]);
      db.handlers.billRefs.mockReturnValue([
        { vid: V1, vyr: YEAR, ref: 'SB00007', due: null, raised: false },
        { vid: V1, vyr: YEAR, ref: 'SB00007', due: null, raised: false },
        { vid: V1, vyr: YEAR, ref: null, due: null, raised: false },
        { vid: V1, vyr: YEAR, ref: 'SB00009', due: null, raised: true },
        { vid: V3, vyr: YEAR, ref: 'SB00012', due: day('2026-12-31'), raised: true },
      ]);

      const { rows } = await service.vouchers(range);

      expect(rows.map((row) => row.billRefs)).toEqual([
        ['SB00007', 'SB00009'],
        ['SB00012 due 31-12'],
      ]);
      expect(valuesOf(db.handlers.billRefs)).toEqual([
        V1,
        YEAR,
        V3,
        YEAR,
        LEDGER_ID,
        V1,
        YEAR,
        V3,
        YEAR,
        LEDGER_ID,
      ]);
      expect(textOfCall(db.handlers.billRefs)).toContain('HAVING SUM(a.abj_amount) <> 0');
    });
  });

  // ── voucherLegs ───────────────────────────────────────────────────────────
  describe('voucherLegs', () => {
    const legsQuery = { companyId: COMPANY_ID, accYear: YEAR, voucherId: V1, ledgerId: LEDGER_ID };

    it('answers every leg of the voucher, marking this ledger’s', async () => {
      db.handlers.voucherHeader.mockReturnValue([
        { refno: 'RCT0004', vdate: day('2026-08-10'), status: 'POSTED' },
      ]);
      db.handlers.legs.mockReturnValue([
        legRow({ dr_cr: 'CR', amount: D('500') }),
        legRow({
          row_no: 2,
          dr_cr: 'DR',
          ledger_id: CASH_ID,
          ledger_name: 'Cash',
          amount: D('500'),
        }),
      ]);

      await expect(service.voucherLegs(legsQuery)).resolves.toEqual({
        voucherId: V1,
        accYear: YEAR,
        voucherNo: 'RCT0004',
        date: '2026-08-10',
        status: 'POSTED',
        legs: [
          expect.objectContaining({ rowNo: 1, side: 'CR', amount: '500.00', isThisLedger: true }),
          expect.objectContaining({
            rowNo: 2,
            side: 'DR',
            ledgerName: 'Cash',
            isThisLedger: false,
          }),
        ],
      });
      expect(valuesOf(db.handlers.voucherHeader)).toEqual([V1, YEAR, COMPANY_ID]);
    });

    it('answers 404 for a voucher this company does not have', async () => {
      const refusal = await refusalOf(service.voucherLegs(legsQuery));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Voucher not found',
          errors: [
            {
              field: 'voucherId',
              code: LEDGER_STATEMENT_ERROR.VOUCHER_NOT_FOUND,
              message: `No voucher ${V1} in ${YEAR} for this company`,
            },
          ],
        },
      });
      expect(db.handlers.legs).not.toHaveBeenCalled();
    });
  });

  // ── daily ─────────────────────────────────────────────────────────────────
  describe('daily', () => {
    it('answers one row per day with movement, between the opening and the closing', async () => {
      db.handlers.daily.mockReturnValue([
        { d: day('2026-08-05'), dr: D('1180'), cr: D(0), n: 1n, closing: D('6180') },
        { d: day('2026-08-10'), dr: D(0), cr: D('7000'), n: 2n, closing: D('-820') },
      ]);

      await expect(service.daily(range)).resolves.toEqual({
        opening: { amount: '5000.00', side: 'DR' },
        days: [
          {
            date: '2026-08-05',
            debit: '1180.00',
            credit: '0.00',
            vouchers: 1,
            closing: { amount: '6180.00', side: 'DR' },
          },
          {
            date: '2026-08-10',
            debit: '0.00',
            credit: '7000.00',
            vouchers: 2,
            closing: { amount: '820.00', side: 'CR' },
          },
        ],
        closing: { amount: '5680.00', side: 'DR' },
      });
      const values = valuesOf(db.handlers.daily);
      expect(values).toEqual(expect.arrayContaining(['2026-08-01', '2026-09-25']));
      expect(values.some((value) => value instanceof Date)).toBe(false);
    });

    it('checks the range before reading the days', async () => {
      await refusalOf(service.daily({ ...range, toDate: '2027-04-01' }));

      expect(db.handlers.daily).not.toHaveBeenCalled();
    });
  });

  // ── monthly ───────────────────────────────────────────────────────────────
  describe('monthly', () => {
    afterEach(() => jest.useRealTimers());

    it('answers all twelve months, the empty ones at zero, with a running closing', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-10-15T06:00:00.000Z'));
      db.handlers.monthly.mockReturnValue([
        { mon: '2026-05', dr: D('1000'), cr: D(0), net: D('1000') },
        { mon: '2026-08', dr: D('1180'), cr: D('7000'), net: D('-5820') },
      ]);

      const result = await service.monthly(scope);

      expect(result.months).toHaveLength(12);
      expect(result.months.map((m) => m.month)).toEqual([
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
        '2027-01',
        '2027-02',
        '2027-03',
      ]);
      expect(result.opening).toEqual({ amount: '5000.00', side: 'DR' });
      expect(result.months[0]).toEqual({
        month: '2026-04',
        debit: '0.00',
        credit: '0.00',
        closing: { amount: '5000.00', side: 'DR' },
        isFuture: false,
      });
      expect(result.months[1].closing).toEqual({ amount: '6000.00', side: 'DR' });
      expect(result.months[4]).toMatchObject({
        debit: '1180.00',
        credit: '7000.00',
        closing: { amount: '180.00', side: 'DR' },
      });
      expect(result.months.filter((m) => m.isFuture).map((m) => m.month)[0]).toBe('2026-11');
      expect(result.closing).toEqual({ amount: '180.00', side: 'DR' });
    });

    it('reads the whole year up to its last day, with no date range to check', async () => {
      await service.monthly(scope);

      expect(valuesOf(db.handlers.monthly)).toEqual(expect.arrayContaining(['2027-03-31']));
    });
  });

  // ── export ────────────────────────────────────────────────────────────────
  describe('export', () => {
    it('answers the header, every row and both forwards, unpaged', async () => {
      db.handlers.core.mockReturnValue([coreRow()]);

      const result = await service.export(range);

      expect(valuesOf(db.handlers.core).slice(-3)).toEqual([true, 20_001, 0]);
      expect(result).toMatchObject({
        ledger: { ledgerId: LEDGER_ID },
        period: { fromDate: '2026-08-01', toDate: '2026-09-25' },
        broughtForward: { amount: '5000.00', side: 'DR' },
        carriedForward: { amount: '5680.00', side: 'DR' },
        totalRows: 1,
      });
      expect(result.rows).toHaveLength(1);
    });

    it('refuses a range over 20 000 vouchers with 422 RANGE_TOO_LARGE and the true count', async () => {
      const row = coreRow({ total_rows: 25_000n });
      db.handlers.core.mockReturnValue(Array.from({ length: 20_001 }, () => row));

      const refusal = await refusalOf(service.export(range));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'Range too large',
          errors: [
            {
              field: 'fromDate',
              code: LEDGER_STATEMENT_ERROR.RANGE_TOO_LARGE,
              count: 25_000,
              message:
                '25000 vouchers in this range — the export stops at 20000. Narrow the dates.',
            },
          ],
        },
      });
      expect(db.handlers.legs).not.toHaveBeenCalled();
    });

    it('exports exactly 20 000 vouchers', async () => {
      const row = coreRow({ total_rows: 20_000n });
      db.handlers.core.mockReturnValue(Array.from({ length: 20_000 }, () => row));

      await expect(service.export(range)).resolves.toMatchObject({ totalRows: 20_000 });
    });
  });
});
