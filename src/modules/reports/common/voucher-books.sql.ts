import { Prisma } from '@prisma/client';

/**
 * The ONE definition of a book balance, shared by the reports that read the
 * `acc_vouchers` legs (Ledger Statement, Account Day Summary — day-summary plan
 * D1). A building block, not a route: each report keeps its own URLs, DTOs and
 * payloads, and imports these fragments.
 *
 *   balance(asOf) = opening set (acc_opening_balance, this year, 'D' +, 'C' −)
 *                 + Σ av_signed_amount of live legs, date ≤ asOf, whose header
 *                   is POSTED **or CANCELLED**
 *
 * CANCELLED counts because a cancel keeps the original's legs and posts a
 * POSTED mirror with the opposite ones: the pair nets to zero. DRAFT and
 * APPROVED never count. Company-scoped always (`av_company_id`,
 * `op_company_id`). Branch: one branch = its opening set and its legs; All =
 * every opening set (company-level + every branch's) and every leg.
 */

export type Side = 'DR' | 'CR';

/** A balance: the magnitude and the side. Zero reads as '0.00' DR. */
export interface SidedAmount {
  amount: string;
  side: Side;
}

export interface BooksScope {
  companyId: string;
  accYear: string;
  /** null = All branches. */
  branchId: string | null;
}

/** Ledger restriction for the fragments: one ledger, a list, or every ledger. */
export type LedgerFilter = { ledgerId: string } | { ledgerIds: readonly string[] } | null;

function ledgerSql(column: string, filter: LedgerFilter): Prisma.Sql {
  if (filter === null) {
    return Prisma.sql`true`;
  }
  if ('ledgerId' in filter) {
    return Prisma.sql`${Prisma.raw(column)} = ${filter.ledgerId}::uuid`;
  }
  return Prisma.sql`${Prisma.raw(column)} = ANY(${[...filter.ledgerIds]}::uuid[])`;
}

/**
 * The counted legs of the scope dated [from, upTo] (from omitted = the whole
 * year up to `upTo`). Columns: av_voucher_id, av_acc_year, av_voucher_date,
 * av_voucher_type_id, av_branch_id, av_ledger_id, av_dr_cr, av_amount,
 * av_signed_amount. One ledger drives from ix_av_ledger; every ledger from
 * ix_av_daybook.
 */
export function countedLegsSql(
  scope: BooksScope,
  opts: { from?: string; upTo: string; ledgers: LedgerFilter },
): Prisma.Sql {
  return Prisma.sql`
      SELECT v.av_voucher_id, v.av_acc_year, v.av_voucher_date, v.av_voucher_type_id,
             v.av_branch_id, v.av_ledger_id, v.av_dr_cr, v.av_amount, v.av_signed_amount
        FROM accounts.acc_vouchers v
        JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
       WHERE v.av_company_id = ${scope.companyId}::uuid
         AND ${ledgerSql('v.av_ledger_id', opts.ledgers)}
         AND v.av_acc_year   = ${scope.accYear}::char(9)
         ${opts.from ? Prisma.sql`AND v.av_voucher_date >= ${opts.from}::date` : Prisma.empty}
         AND v.av_voucher_date <= ${opts.upTo}::date
         AND v.av_is_deleted = false
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
         AND (${scope.branchId}::uuid IS NULL OR v.av_branch_id = ${scope.branchId}::uuid)`;
}

/**
 * The opening set per ledger (`ledger_id`, signed `amt`, 'D' +, 'C' −). One
 * branch = that branch's rows only; All = every row (company-level and every
 * branch's).
 */
export function openingSetSql(scope: BooksScope, ledgers: LedgerFilter): Prisma.Sql {
  return Prisma.sql`
      SELECT o.op_ledger_id AS ledger_id,
             SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END) AS amt
        FROM accounts.acc_opening_balance o
       WHERE o.op_company_id = ${scope.companyId}::uuid
         AND ${ledgerSql('o.op_ledger_id', ledgers)}
         AND o.op_acc_year   = ${scope.accYear}::char(9)
         AND o.op_is_deleted = false
         AND (${scope.branchId}::uuid IS NULL OR o.op_branch_id = ${scope.branchId}::uuid)
       GROUP BY o.op_ledger_id`;
}

/**
 * Per ledger: is the opening set company-level only for a branch view (§4.2's
 * `COMPANY_LEVEL_ONLY` note)? Columns: ledger_id, branch_rows, company_rows.
 * Only meaningful when `scope.branchId` is set.
 */
export function openingNoteSql(scope: BooksScope, ledgers: LedgerFilter): Prisma.Sql {
  return Prisma.sql`
      SELECT o.op_ledger_id AS ledger_id,
             COUNT(*) FILTER (WHERE o.op_branch_id = ${scope.branchId}::uuid) AS branch_rows,
             COUNT(*) FILTER (WHERE o.op_branch_id IS NULL AND o.op_amount <> 0) AS company_rows
        FROM accounts.acc_opening_balance o
       WHERE o.op_company_id = ${scope.companyId}::uuid
         AND ${ledgerSql('o.op_ledger_id', ledgers)}
         AND o.op_acc_year   = ${scope.accYear}::char(9)
         AND o.op_is_deleted = false
       GROUP BY o.op_ledger_id`;
}

/** user_master row of a text `*_created_by` column that holds a uuid (else no row). */
export function createdByJoinSql(column: string, alias: string): Prisma.Sql {
  return Prisma.sql`
        LEFT JOIN public.user_master ${Prisma.raw(alias)}
          ON ${Prisma.raw(column)} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND ${Prisma.raw(alias)}.usr_id = ${Prisma.raw(column)}::uuid`;
}

// ── wire formatting ─────────────────────────────────────────────────────────

/** Two decimals, as a string — never a float on the wire. */
export function money(value: Prisma.Decimal | string | number | null | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

/** +DR / −CR, never a minus sign on the wire. */
export function sided(value: Prisma.Decimal | string | number | null | undefined): SidedAmount {
  const d = new Prisma.Decimal(value ?? 0);
  return { amount: d.abs().toFixed(2), side: d.isNegative() ? 'CR' : 'DR' };
}

/** A DATE column (read back as UTC midnight) as YYYY-MM-DD. */
export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
