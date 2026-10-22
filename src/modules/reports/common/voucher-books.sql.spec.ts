import { Prisma } from '@prisma/client';
import {
  BooksScope,
  countedLegsSql,
  createdByJoinSql,
  isoDate,
  money,
  openingNoteSql,
  openingSetSql,
  sided,
} from './voucher-books.sql';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const OTHER_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46b004';

const ALL_BRANCHES: BooksScope = { companyId: COMPANY_ID, accYear: '2026-2027', branchId: null };
const ONE_BRANCH: BooksScope = { ...ALL_BRANCHES, branchId: BRANCH_ID };

/** The statement text with its whitespace collapsed, so fragments can be matched. */
const textOf = (sql: Prisma.Sql) => sql.sql.replace(/\s+/g, ' ');

describe('voucher-books.sql', () => {
  // ── countedLegsSql ────────────────────────────────────────────────────────
  describe('countedLegsSql', () => {
    it('counts the live legs of POSTED and CANCELLED headers only, company-scoped', () => {
      const sql = countedLegsSql(ALL_BRANCHES, {
        upTo: '2026-09-25',
        ledgers: { ledgerId: LEDGER_ID },
      });

      const text = textOf(sql);
      expect(text).toContain('FROM accounts.acc_vouchers v');
      expect(text).toContain('v.av_company_id = ?::uuid');
      expect(text).toContain("h.avh_voucher_status IN ('POSTED', 'CANCELLED')");
      expect(text).toContain('v.av_is_deleted = false AND h.avh_is_deleted = false');
      expect(text).toContain('v.av_voucher_date <= ?::date');
      expect(text).not.toContain('v.av_voucher_date >= ?::date');
    });

    it('binds the dates as YYYY-MM-DD text cast ::date, never as JS Dates', () => {
      const sql = countedLegsSql(ONE_BRANCH, {
        from: '2026-08-01',
        upTo: '2026-09-25',
        ledgers: { ledgerId: LEDGER_ID },
      });

      expect(textOf(sql)).toContain('v.av_voucher_date >= ?::date');
      expect(sql.values).toEqual([
        COMPANY_ID,
        LEDGER_ID,
        '2026-2027',
        '2026-08-01',
        '2026-09-25',
        BRANCH_ID,
        BRANCH_ID,
      ]);
      expect(sql.values.some((value) => value instanceof Date)).toBe(false);
    });

    it('lets every branch through when the scope names none', () => {
      const sql = countedLegsSql(ALL_BRANCHES, { upTo: '2026-09-25', ledgers: null });

      expect(textOf(sql)).toContain('(?::uuid IS NULL OR v.av_branch_id = ?::uuid)');
      expect(sql.values.slice(-2)).toEqual([null, null]);
    });

    it.each([
      ['one ledger', { ledgerId: LEDGER_ID }, 'v.av_ledger_id = ?::uuid', LEDGER_ID],
      [
        'a list of ledgers',
        { ledgerIds: [LEDGER_ID, OTHER_LEDGER_ID] },
        'v.av_ledger_id = ANY(?::uuid[])',
        [LEDGER_ID, OTHER_LEDGER_ID],
      ],
    ])('narrows to %s', (_label, ledgers, fragment, bound) => {
      const sql = countedLegsSql(ALL_BRANCHES, { upTo: '2026-09-25', ledgers });

      expect(textOf(sql)).toContain(fragment);
      expect(sql.values[1]).toEqual(bound);
    });

    it('reads every ledger when no ledger filter is given', () => {
      const sql = countedLegsSql(ALL_BRANCHES, { upTo: '2026-09-25', ledgers: null });

      expect(textOf(sql)).toContain('AND true AND v.av_acc_year');
      expect(sql.values).not.toContain(LEDGER_ID);
    });

    it('binds a copy of the ledger list, not the caller’s own array', () => {
      const ledgerIds = [LEDGER_ID];
      const sql = countedLegsSql(ALL_BRANCHES, { upTo: '2026-09-25', ledgers: { ledgerIds } });

      expect(sql.values[1]).toEqual(ledgerIds);
      expect(sql.values[1]).not.toBe(ledgerIds);
    });
  });

  // ── the opening set ───────────────────────────────────────────────────────
  describe('openingSetSql', () => {
    it("signs 'D' rows + and 'C' rows −, one figure per ledger", () => {
      const sql = openingSetSql(ONE_BRANCH, { ledgerId: LEDGER_ID });

      const text = textOf(sql);
      expect(text).toContain(
        "SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END) AS amt",
      );
      expect(text).toContain('GROUP BY o.op_ledger_id');
      expect(text).toContain('o.op_is_deleted = false');
      expect(sql.values).toEqual([COMPANY_ID, LEDGER_ID, '2026-2027', BRANCH_ID, BRANCH_ID]);
    });

    it('takes every opening row, company-level included, for All branches', () => {
      const sql = openingSetSql(ALL_BRANCHES, null);

      expect(textOf(sql)).toContain('(?::uuid IS NULL OR o.op_branch_id = ?::uuid)');
      expect(sql.values).toEqual([COMPANY_ID, '2026-2027', null, null]);
    });
  });

  describe('openingNoteSql', () => {
    it('counts the branch’s own rows and the non-zero company-level rows, over every branch', () => {
      const sql = openingNoteSql(ONE_BRANCH, { ledgerIds: [LEDGER_ID] });

      const text = textOf(sql);
      expect(text).toContain('COUNT(*) FILTER (WHERE o.op_branch_id = ?::uuid) AS branch_rows');
      expect(text).toContain(
        'COUNT(*) FILTER (WHERE o.op_branch_id IS NULL AND o.op_amount <> 0) AS company_rows',
      );
      // The WHERE does not narrow by branch: the company-level rows must be counted too.
      expect(text.split(' WHERE ')[1]).not.toContain('op_branch_id');
      expect(sql.values).toEqual([BRANCH_ID, COMPANY_ID, [LEDGER_ID], '2026-2027']);
    });
  });

  // ── createdByJoinSql ──────────────────────────────────────────────────────
  describe('createdByJoinSql', () => {
    it('casts the text column to uuid only inside a CASE that has checked it is one', () => {
      const sql = createdByJoinSql('h.avh_created_by', 'u');

      expect(textOf(sql)).toBe(
        ' LEFT JOIN public.user_master u ON u.usr_id = CASE WHEN h.avh_created_by ~* ' +
          "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' " +
          'THEN h.avh_created_by::uuid END',
      );
      expect(sql.values).toEqual([]);
    });
  });

  // ── wire formatting ───────────────────────────────────────────────────────
  describe('money', () => {
    it.each([
      [new Prisma.Decimal('1234.5'), '1234.50'],
      ['0.005', '0.01'],
      ['-2.345', '-2.35'],
      [7, '7.00'],
      [null, '0.00'],
      [undefined, '0.00'],
      ['12345678901234567.89', '12345678901234567.89'],
    ])('writes %p as %p', (value, wire) => {
      expect(money(value)).toBe(wire);
    });
  });

  describe('sided', () => {
    it.each([
      [new Prisma.Decimal('1500.25'), { amount: '1500.25', side: 'DR' }],
      ['-1500.25', { amount: '1500.25', side: 'CR' }],
      [0, { amount: '0.00', side: 'DR' }],
      [null, { amount: '0.00', side: 'DR' }],
      ['-98765432109876.54', { amount: '98765432109876.54', side: 'CR' }],
    ])('writes %p with its side and never a minus sign', (value, wire) => {
      expect(sided(value)).toEqual(wire);
    });
  });

  describe('isoDate', () => {
    it('reads a DATE column, which comes back as UTC midnight, as YYYY-MM-DD', () => {
      expect(isoDate(new Date('2026-09-25T00:00:00.000Z'))).toBe('2026-09-25');
    });
  });
});
