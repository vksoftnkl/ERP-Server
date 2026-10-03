import { Injectable } from '@nestjs/common';
import {
  AccountsErrorDetail,
  throwAccountsNotFound,
} from '../../../common/utils/module-service.utils';
import { PgService } from '../../../database/pg/pg.service';
import { GetPartyCreditSummaryDto } from './dto/get-party-credit-summary.dto';
import { PartyCreditSummary } from './types/bill-balance-api.types';

/**
 * The row the credit-summary query hands back. Every monetary column is cast to
 * `numeric(18,2)` in SQL, and node-pg surfaces `numeric` as a string, so the
 * exact fixed-point value survives the trip out of Postgres untouched by float.
 * `date` columns arrive as `YYYY-MM-DD` text (see PgService's DATE_AS_TEXT).
 */
interface CreditSummaryRow {
  as_on_date: string;
  party_found: boolean | null;
  party_name: string | null;
  credit_check_enabled: boolean;
  pending_amount: string;
  pending_bill_count: number;
  overdue_amount: string;
  overdue_bill_count: number;
  oldest_overdue_due_date: string | null;
  max_overdue_days: number;
  credit_amt_limit: string;
  credit_bill_limit: number;
  available_credit_amount: string;
  available_bill_count: number;
}

/**
 * One party's outstanding position and credit ceilings, in a single round-trip.
 *
 * ── Why there is no acc-year filter ──────────────────────────────────────────
 * acc_bill_balance is partitioned by abl_acc_year, but the partition records
 * where a bill STARTED, not where the money is: a bill outstanding past year end
 * keeps its original year and never moves. Filtering the credit check on the
 * entry screen's year would therefore drop every still-open bill raised before
 * it — and the known year-end carry-forward gap (clients run FY generation on
 * April 1, then key missed prior-FY receipts afterwards) guarantees those exist.
 * A customer would come up clean on their first bill of the new year while
 * carrying real debt. So the aggregate scans every partition, which is what the
 * table's own design notes prescribe for outstanding and ageing reads.
 *
 * ── Why DR and CR are signed apart ───────────────────────────────────────────
 * abl_dr_cr is DR = receivable, CR = payable, and BOTH sides sit in this table
 * with a positive abl_pending_amount. A sale-order ADVANCE is a CR row: the
 * customer's own money, held. Summing the column flat would count that advance
 * as money the customer OWES — backwards, and it would block a party who has
 * paid ahead. pendingAmount is therefore SUM(DR) − SUM(CR), and pendingBillCount
 * counts DR rows only, since an advance is not a bill against the bill limit.
 */
@Injectable()
export class BillBalanceService {
  constructor(private readonly pg: PgService) {}

  async getCreditSummary(query: GetPartyCreditSummaryDto): Promise<PartyCreditSummary> {
    const { partyId } = query;
    // Only partyId is required. Each of the others is a narrowing filter that
    // the SQL short-circuits when it is null — `col = NULL` would match nothing.
    const companyId = query.companyId ?? null;
    const branchId = query.branchId ?? null;
    const accYear = query.accYear ?? null;

    const { rows } = await this.pg.query<CreditSummaryRow>(CREDIT_SUMMARY_SQL, [
      companyId,
      branchId,
      partyId,
    ]);

    // `bill` is a bare aggregate over an empty-able set, so it always returns
    // exactly one row and this array is never empty. Guarded anyway — a missing
    // row must not read as "no outstanding".
    const row = rows[0];
    if (!row || !row.party_found) {
      // Unknown, soft-deleted, or another tenant's party. A party who simply has
      // no open bills is a 200 with zeroes, which is why the sentinel is
      // party_found and not a null total — and not party_name either, since
      // cus_name is itself nullable.
      throwAccountsNotFound<AccountsErrorDetail>(
        'Party not found',
        'partyId',
        companyId
          ? `No active customer found for id ${partyId} under company ${companyId}`
          : `No active customer found for id ${partyId}`,
      );
    }

    const isCreditCheckEnabled = row.credit_check_enabled;
    const availableCreditAmount = isCreditCheckEnabled
      ? toFixedNumber(row.available_credit_amount)
      : null;
    const availableBillCount = isCreditCheckEnabled ? row.available_bill_count : null;

    return {
      partyId,
      partyName: row.party_name,
      accYear,
      asOnDate: row.as_on_date,

      pendingAmount: toFixedNumber(row.pending_amount),
      pendingBillCount: row.pending_bill_count,

      overdueAmount: toFixedNumber(row.overdue_amount),
      overdueBillCount: row.overdue_bill_count,
      oldestOverdueDueDate: row.oldest_overdue_due_date,
      maxOverdueDays: row.max_overdue_days,

      creditAmtLimit: toFixedNumber(row.credit_amt_limit),
      creditBillLimit: row.credit_bill_limit,

      availableCreditAmount,
      availableBillCount,

      // Not clamped at zero: the entry screen renders the negative as
      // "exceeded by". With the check off there is no ceiling, so nothing trips.
      isAmtLimitExceeded: availableCreditAmount !== null && availableCreditAmount < 0,
      isBillLimitExceeded: availableBillCount !== null && availableBillCount < 0,
      isCreditCheckEnabled,
    };
  }
}

/**
 * numeric → number. The string is already rounded to two decimals by the SQL
 * cast, so this only changes the JSON type, never the value.
 */
function toFixedNumber(value: string | number | null): number {
  if (value === null) {
    return 0;
  }
  return typeof value === 'number' ? value : Number(value);
}

// $1 company_id (nullable), $2 branch_id (nullable), $3 party_id. Only the party
// is required, so it leads both predicates and leads ix_abl_party_credit's key —
// the company/branch clauses are pure narrowing and short-circuit to "no filter"
// when null.
//
// Overdue is always measured against CURRENT_DATE. It is STABLE, so every
// reference below sees the same value within the statement and the FILTERs,
// max_overdue_days and the echoed as_on_date can never disagree.
//
// No acc-year parameter — see the class doc. The bill predicate is written to
// match ix_abl_party_credit's partial predicate so the aggregate is an
// index-only scan across the partitions rather than a heap sweep.
const CREDIT_SUMMARY_SQL = `
WITH bill AS (
  SELECT
    -- DR is owed to us, CR is held for the party. Signed, so an advance reduces
    -- the outstanding instead of inflating it.
    COALESCE(SUM(
      CASE WHEN ab.abl_dr_cr = 'DR' THEN ab.abl_pending_amount
           ELSE -ab.abl_pending_amount END
    ), 0)::numeric(18,2)                                                  AS pending_amount,
    COUNT(*) FILTER (WHERE ab.abl_dr_cr = 'DR')::int                      AS pending_bill_count,
    COALESCE(SUM(ab.abl_pending_amount) FILTER (
      WHERE ab.abl_dr_cr = 'DR' AND ab.abl_due_date < CURRENT_DATE
    ), 0)::numeric(18,2)                                                  AS overdue_amount,
    COUNT(*) FILTER (
      WHERE ab.abl_dr_cr = 'DR' AND ab.abl_due_date < CURRENT_DATE
    )::int                                                                AS overdue_bill_count,
    MIN(ab.abl_due_date) FILTER (
      WHERE ab.abl_dr_cr = 'DR' AND ab.abl_due_date < CURRENT_DATE
    )                                                                     AS oldest_overdue_due_date
  FROM accounts.acc_bill_balance ab
  -- Party first: it is the only parameter that is always present, and the only
  -- one ix_abl_party_credit can therefore always lead its scan with.
  WHERE ab.abl_party_id = $3::uuid
    AND ($1::uuid IS NULL OR ab.abl_company_id = $1::uuid)
    AND ($2::uuid IS NULL OR ab.abl_branch_id = $2::uuid)
    AND ab.abl_is_deleted = false
    AND ab.abl_pending_amount > 0
),
cust AS (
  SELECT
    TRUE                                                AS party_found,
    cm.cus_name                                         AS party_name,
    cm.cus_credit_allowed                               AS credit_check_enabled,
    COALESCE(cm.cus_credit_amt_limit, 0)::numeric(18,2) AS credit_amt_limit,
    COALESCE(cm.cus_credit_bill_limit, 0)::int          AS credit_bill_limit
  FROM sales.customers cm
  WHERE cm.cus_id = $3::uuid
    -- With no company given the party resolves unscoped. With one, cus_company_id
    -- is nullable — a customer with no company is shared across them — so NULL
    -- passes while a customer belonging to ANOTHER company misses and 404s.
    AND ($1::uuid IS NULL OR cm.cus_company_id = $1::uuid OR cm.cus_company_id IS NULL)
    AND cm.cus_is_deleted = false
)
SELECT
  CURRENT_DATE                                                     AS as_on_date,
  c.party_found,
  c.party_name,
  COALESCE(c.credit_check_enabled, false)                          AS credit_check_enabled,
  b.pending_amount,
  b.pending_bill_count,
  b.overdue_amount,
  b.overdue_bill_count,
  b.oldest_overdue_due_date,
  COALESCE(CURRENT_DATE - b.oldest_overdue_due_date, 0)::int       AS max_overdue_days,
  COALESCE(c.credit_amt_limit, 0)                                  AS credit_amt_limit,
  COALESCE(c.credit_bill_limit, 0)                                 AS credit_bill_limit,
  (COALESCE(c.credit_amt_limit, 0) - b.pending_amount)             AS available_credit_amount,
  (COALESCE(c.credit_bill_limit, 0) - b.pending_bill_count)        AS available_bill_count
FROM bill b
-- LEFT JOIN, not CROSS: cust returns zero rows for an unknown party, and a
-- CROSS JOIN would collapse the whole result to an empty set — which the
-- service would then have to report as "no outstanding" instead of 404.
LEFT JOIN cust c ON TRUE
`;
