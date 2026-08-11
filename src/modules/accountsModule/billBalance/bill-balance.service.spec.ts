import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PgService } from '../../../database/pg/pg.service';
import { BillBalanceService } from './bill-balance.service';
import { GetPartyCreditSummaryDto } from './dto/get-party-credit-summary.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const ACC_YEAR = '2025-2026';
// The server date the stub query reports back; not a request parameter.
const AS_ON_DATE = '2026-08-11';

/** The shape the credit-summary SQL returns — numerics as strings, dates as text. */
type Row = Record<string, unknown>;

/** A party with a limit, some outstanding and some of it overdue. */
const makeRow = (overrides: Row = {}): Row => ({
  as_on_date: AS_ON_DATE,
  party_found: true,
  party_name: 'Sri Balaji Stores',
  credit_check_enabled: true,
  pending_amount: '125000.00',
  pending_bill_count: 12,
  overdue_amount: '45000.00',
  overdue_bill_count: 4,
  oldest_overdue_due_date: '2026-05-12',
  max_overdue_days: 91,
  credit_amt_limit: '200000.00',
  credit_bill_limit: 20,
  available_credit_amount: '75000.00',
  available_bill_count: 8,
  ...overrides,
});

/** Everything a party with no open bills aggregates to. */
const ZERO_BILLS: Row = {
  pending_amount: '0.00',
  pending_bill_count: 0,
  overdue_amount: '0.00',
  overdue_bill_count: 0,
  oldest_overdue_due_date: null,
  max_overdue_days: 0,
  available_credit_amount: '200000.00',
  available_bill_count: 20,
};

/** The usual call an entry screen makes: everything an entry screen knows. */
const makeQuery = (
  overrides: Partial<GetPartyCreditSummaryDto> = {},
): GetPartyCreditSummaryDto => ({
  companyId: COMPANY_ID,
  accYear: ACC_YEAR,
  partyId: PARTY_ID,
  ...overrides,
});

/** PgService.query, narrowed to the (sql, params) call the service makes. */
type QueryMock = jest.Mock<Promise<{ rows: Row[] }>, [string, unknown[]]>;

describe('BillBalanceService.getCreditSummary', () => {
  let pg: { query: QueryMock };
  let service: BillBalanceService;

  /** Resolve the next query with one row. Returns the mock for param assertions. */
  const respondWith = (row: Row | null) => {
    pg.query.mockResolvedValue({ rows: row ? [row] : [] });
  };

  /** The parameter array the service bound: [company, branch, party]. */
  const boundParams = (): unknown[] => pg.query.mock.calls[0][1];
  const executedSql = (): string => pg.query.mock.calls[0][0];

  beforeEach(() => {
    pg = { query: jest.fn() as QueryMock };
    service = new BillBalanceService(pg as unknown as PgService);
  });

  it('returns the documented shape for a party with outstanding', async () => {
    respondWith(makeRow());

    await expect(service.getCreditSummary(makeQuery())).resolves.toEqual({
      partyId: PARTY_ID,
      partyName: 'Sri Balaji Stores',
      accYear: ACC_YEAR,
      asOnDate: AS_ON_DATE,
      pendingAmount: 125000,
      pendingBillCount: 12,
      overdueAmount: 45000,
      overdueBillCount: 4,
      oldestOverdueDueDate: '2026-05-12',
      maxOverdueDays: 91,
      creditAmtLimit: 200000,
      creditBillLimit: 20,
      availableCreditAmount: 75000,
      availableBillCount: 8,
      isAmtLimitExceeded: false,
      isBillLimitExceeded: false,
      isCreditCheckEnabled: true,
    });
  });

  describe('partyId is the only required parameter', () => {
    it('reads across every company and branch when only partyId is given', async () => {
      respondWith(makeRow());

      const result = await service.getCreditSummary({ partyId: PARTY_ID });

      expect(boundParams()).toEqual([null, null, PARTY_ID]);
      // Null has to short-circuit the predicate, not be compared against —
      // `abl_company_id = NULL` matches nothing and would zero the position.
      expect(executedSql()).toContain('$1::uuid IS NULL OR ab.abl_company_id = $1::uuid');
      expect(result.accYear).toBeNull();
    });

    it('leads both predicates with the party, the only always-present filter', async () => {
      respondWith(makeRow());

      await service.getCreditSummary({ partyId: PARTY_ID });

      // Party leads so ix_abl_party_credit's key prefix is usable even when the
      // caller supplies no company.
      expect(executedSql()).toContain('WHERE ab.abl_party_id = $3::uuid');
      expect(executedSql()).toContain('WHERE cm.cus_id = $3::uuid');
    });

    it('still resolves the party unscoped rather than 404ing when no company is given', async () => {
      respondWith(makeRow());

      await expect(service.getCreditSummary({ partyId: PARTY_ID })).resolves.toMatchObject({
        partyName: 'Sri Balaji Stores',
      });
      expect(executedSql()).toContain('$1::uuid IS NULL OR cm.cus_company_id = $1::uuid');
    });
  });

  describe('branch scope', () => {
    it('binds a null branch when branchId is omitted, so every branch aggregates', async () => {
      respondWith(makeRow());

      await service.getCreditSummary(makeQuery());

      expect(boundParams()[1]).toBeNull();
      // The null branch has to short-circuit the predicate rather than compare,
      // or `abl_branch_id = NULL` would match nothing.
      expect(executedSql()).toContain('$2::uuid IS NULL OR ab.abl_branch_id = $2::uuid');
    });

    it('binds the branch when branchId is supplied', async () => {
      respondWith(makeRow());

      await service.getCreditSummary(makeQuery({ branchId: BRANCH_ID }));

      expect(boundParams()[1]).toBe(BRANCH_ID);
    });
  });

  describe('as-on date', () => {
    it('measures overdue against the server date, with no parameter to override it', async () => {
      respondWith(makeRow({ as_on_date: '2026-09-01' }));

      const result = await service.getCreditSummary(makeQuery());

      // Three bound parameters, none of them a date.
      expect(boundParams()).toHaveLength(3);
      expect(executedSql()).not.toContain('$4');
      expect(executedSql()).toContain('CURRENT_DATE');
      // Reported back from the row, so the client sees the date actually used
      // rather than trusting its own clock and timezone.
      expect(result.asOnDate).toBe('2026-09-01');
    });

    it('measures the FILTERs and the ageing against the same date', async () => {
      respondWith(makeRow());

      await service.getCreditSummary(makeQuery());

      const sql = executedSql();
      // CURRENT_DATE is STABLE, so all five references — three overdue FILTERs,
      // the ageing subtraction and the echoed as_on_date — agree within the
      // statement. The overdue set can never be measured against one date and
      // maxOverdueDays reported against another.
      expect(sql.match(/CURRENT_DATE/g)).toHaveLength(5);
      expect(sql).toContain('COALESCE(CURRENT_DATE - b.oldest_overdue_due_date, 0)');
    });
  });

  it('returns zeroes and a null oldest due date for a party with no open bills', async () => {
    respondWith(makeRow(ZERO_BILLS));

    const result = await service.getCreditSummary(makeQuery());

    expect(result).toMatchObject({
      pendingAmount: 0,
      pendingBillCount: 0,
      overdueAmount: 0,
      overdueBillCount: 0,
      oldestOverdueDueDate: null,
      maxOverdueDays: 0,
      availableCreditAmount: 200000,
      availableBillCount: 20,
      isAmtLimitExceeded: false,
      isBillLimitExceeded: false,
    });
  });

  describe('404s', () => {
    it('throws when the party is unknown or soft-deleted', async () => {
      // cust matched nothing, so the LEFT JOIN leaves its columns null while the
      // bill aggregate still returns its row of zeroes.
      respondWith(
        makeRow({
          ...ZERO_BILLS,
          party_found: null,
          party_name: null,
          credit_check_enabled: false,
        }),
      );

      await expect(service.getCreditSummary(makeQuery())).rejects.toBeInstanceOf(NotFoundException);
    });

    it("resolves a customer with no company under any companyId, with that company's bills only", async () => {
      // cus_company_id is nullable and ~half the customer master leaves it null:
      // those parties are shared, not owned, so the name and limits resolve under
      // any tenant. The MONEY stays scoped — the bill aggregate filters on
      // abl_company_id regardless — so a foreign company sees zeroes, never
      // another tenant's outstanding.
      respondWith(makeRow({ ...ZERO_BILLS }));

      await expect(
        service.getCreditSummary(makeQuery({ companyId: OTHER_COMPANY_ID })),
      ).resolves.toMatchObject({ partyName: 'Sri Balaji Stores', pendingAmount: 0 });
      expect(executedSql()).toContain('ab.abl_company_id = $1::uuid');
    });

    it('throws for a company-scoped party requested under another company', async () => {
      respondWith(
        makeRow({
          ...ZERO_BILLS,
          party_found: null,
          party_name: null,
          credit_check_enabled: false,
        }),
      );

      await expect(
        service.getCreditSummary(makeQuery({ companyId: OTHER_COMPANY_ID })),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(boundParams()[0]).toBe(OTHER_COMPANY_ID);
    });

    it('does not mistake a party whose name is null for a missing party', async () => {
      // cus_name is nullable, which is why party_found is the sentinel.
      respondWith(makeRow({ party_name: null }));

      await expect(service.getCreditSummary(makeQuery())).resolves.toMatchObject({
        partyName: null,
      });
    });

    it('throws rather than reporting no outstanding when the query returns no row at all', async () => {
      respondWith(null);

      await expect(service.getCreditSummary(makeQuery())).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('limits', () => {
    it('reports a negative available amount, unclamped, when the party is over the amount limit', async () => {
      respondWith(makeRow({ pending_amount: '260000.00', available_credit_amount: '-60000.00' }));

      await expect(service.getCreditSummary(makeQuery())).resolves.toMatchObject({
        availableCreditAmount: -60000,
        isAmtLimitExceeded: true,
        isBillLimitExceeded: false,
      });
    });

    it('reports a negative available bill count, unclamped, when the party is over the bill limit', async () => {
      respondWith(makeRow({ pending_bill_count: 23, available_bill_count: -3 }));

      await expect(service.getCreditSummary(makeQuery())).resolves.toMatchObject({
        availableBillCount: -3,
        isBillLimitExceeded: true,
        isAmtLimitExceeded: false,
      });
    });

    it('does not trip either flag exactly at the limit', async () => {
      respondWith(
        makeRow({
          pending_amount: '200000.00',
          pending_bill_count: 20,
          available_credit_amount: '0.00',
          available_bill_count: 0,
        }),
      );

      await expect(service.getCreditSummary(makeQuery())).resolves.toMatchObject({
        availableCreditAmount: 0,
        availableBillCount: 0,
        isAmtLimitExceeded: false,
        isBillLimitExceeded: false,
      });
    });

    it('nulls the available fields and clears both flags when credit checking is off', async () => {
      // cus_credit_allowed = false, no limit configured. Without this the party
      // would come back over a zero limit and every unconfigured customer would
      // be blocked at billing.
      respondWith(
        makeRow({
          credit_check_enabled: false,
          credit_amt_limit: '0.00',
          credit_bill_limit: 0,
          available_credit_amount: '-125000.00',
          available_bill_count: -12,
        }),
      );

      await expect(service.getCreditSummary(makeQuery())).resolves.toMatchObject({
        creditAmtLimit: 0,
        creditBillLimit: 0,
        availableCreditAmount: null,
        availableBillCount: null,
        isAmtLimitExceeded: false,
        isBillLimitExceeded: false,
        isCreditCheckEnabled: false,
      });
    });
  });

  describe('the aggregate SQL', () => {
    beforeEach(() => respondWith(makeRow()));

    it('excludes soft-deleted rows and rows with nothing pending, from both sum and count', async () => {
      await service.getCreditSummary(makeQuery());

      const sql = executedSql();
      expect(sql).toContain('ab.abl_is_deleted = false');
      expect(sql).toContain('ab.abl_pending_amount > 0');
      // One WHERE feeds every aggregate, so the exclusions cannot apply to the
      // sum but miss the count.
      expect(sql.match(/FROM accounts\.acc_bill_balance/g)).toHaveLength(1);
    });

    it('nets CR against DR instead of summing the column flat', async () => {
      await service.getCreditSummary(makeQuery());

      // A sale-order ADVANCE is a CR row with a POSITIVE pending amount — the
      // customer's own money. Summed flat it would read as debt.
      expect(executedSql()).toContain('ELSE -ab.abl_pending_amount');
      expect(executedSql()).toContain("COUNT(*) FILTER (WHERE ab.abl_dr_cr = 'DR')");
    });

    it('scopes overdue to receivables due before the as-on date', async () => {
      await service.getCreditSummary(makeQuery());

      expect(executedSql()).toContain("ab.abl_dr_cr = 'DR' AND ab.abl_due_date < CURRENT_DATE");
    });

    it('carries no accounting-year filter, so prior-year debt still counts', async () => {
      await service.getCreditSummary(makeQuery());

      // A bill never leaves the partition of the year it was raised in, so a
      // year filter would silently drop real outstanding.
      expect(executedSql()).not.toContain('abl_acc_year');
      expect(boundParams()).toHaveLength(3);
      expect(boundParams()).not.toContain(ACC_YEAR);
    });

    it('LEFT JOINs the customer so an unknown party cannot collapse the result set', async () => {
      await service.getCreditSummary(makeQuery());

      expect(executedSql()).toContain('LEFT JOIN cust c ON TRUE');
    });

    it('binds every value as a parameter rather than interpolating it', async () => {
      await service.getCreditSummary(makeQuery({ branchId: BRANCH_ID }));

      expect(boundParams()).toEqual([COMPANY_ID, BRANCH_ID, PARTY_ID]);
      expect(executedSql()).not.toContain(PARTY_ID);
    });

    it('casts money to numeric(18,2) so the values leave Postgres exact', async () => {
      await service.getCreditSummary(makeQuery());

      expect(executedSql()).toContain('::numeric(18,2)');
    });
  });

  it('converts numeric strings to numbers without losing the two decimals', async () => {
    respondWith(makeRow({ pending_amount: '125000.55', available_credit_amount: '74999.45' }));

    const result = await service.getCreditSummary(makeQuery());

    expect(result.pendingAmount).toBe(125000.55);
    expect(result.availableCreditAmount).toBe(74999.45);
    expect(typeof result.pendingAmount).toBe('number');
  });
});

describe('GetPartyCreditSummaryDto', () => {
  const validateQuery = async (raw: Record<string, unknown>) =>
    validate(plainToInstance(GetPartyCreditSummaryDto, raw));

  const VALID = { companyId: COMPANY_ID, accYear: ACC_YEAR, partyId: PARTY_ID };

  it('accepts partyId on its own — it is the only required parameter', async () => {
    await expect(validateQuery({ partyId: PARTY_ID })).resolves.toHaveLength(0);
  });

  it('accepts every parameter together', async () => {
    await expect(
      validateQuery({ ...VALID, branchId: BRANCH_ID }),
    ).resolves.toHaveLength(0);
  });

  it('rejects a missing partyId', async () => {
    const errors = await validateQuery({ companyId: COMPANY_ID });
    expect(errors.map((error) => error.property)).toContain('partyId');
  });

  it.each(['companyId', 'accYear'])('accepts a missing %s', async (property) => {
    const raw: Record<string, unknown> = { ...VALID };
    delete raw[property];

    await expect(validateQuery(raw)).resolves.toHaveLength(0);
  });

  it.each([
    ['a malformed companyId', { ...VALID, companyId: 'not-a-uuid' }, 'companyId'],
    ['a malformed partyId', { ...VALID, partyId: 'not-a-uuid' }, 'partyId'],
    ['a malformed branchId', { ...VALID, branchId: 'not-a-uuid' }, 'branchId'],
    ['an accYear that is not YYYY-YYYY', { ...VALID, accYear: '2025' }, 'accYear'],
    ['an accYear with a slash', { ...VALID, accYear: '2025/2026' }, 'accYear'],
  ])('rejects %s', async (_label, raw, property) => {
    // Optional still means validated when present — a malformed value is a 400,
    // not a silently ignored filter.
    const errors = await validateQuery(raw);
    expect(errors.map((error) => error.property)).toContain(property);
  });
});
