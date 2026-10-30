import { Prisma } from '@prisma/client';
import { countedLegsSql, type BooksScope } from '../common/voucher-books.sql';

/**
 * Plan §6.1 — the CTE chain every figure of the module is read from. Values
 * are always parameters; nothing is spliced as text.
 *
 *   lg  the counted legs of the scope in [from, to] — every type (§4.1 via the
 *       shared countedLegsSql). Driven from the legs (ix_av_daybook), headers
 *       joined by pk: no header index covers CANCELLED by date (D6).
 *   hd  one row per voucher in lg. A header with no live leg is not here — the
 *       LEGLESS check lists those (§3.7).
 *   hk  hd ⋈ its header, plus the header naming it in avh_reversal_voucher_id
 *       (ix_avh_reversal) — that is what makes a POSTED row a REVERSAL (§3.3).
 *       avh_against_voucher_id alone proves nothing: PDC vouchers use it too.
 *   k   row kind, the other half of its cancel pair, and whether that half is
 *       in hd too (pair_in) and on the same date (pair_day).
 *   cl  the legs that COUNT: lg ⋈ k without the pairs the rule leaves out,
 *       then the voucherTypeId filter.
 *
 * The type filter is applied in cl, AFTER k (the plan's §6.1 note): a Rev-type
 * mirror of a cancelled Jrl must still pair with it when the filter is Jrl.
 *
 * Pair rule RANGE (summary, vouchers, groups): both halves anywhere in
 * [from, to]. Pair rule DAY (/daily): both halves on the same date, so each
 * day's closing is the true book balance at that day's end.
 */

export interface DsSqlScope extends BooksScope {
  from: string;
  to: string;
  voucherTypeId: number | null;
}

export type PairRule = 'RANGE' | 'DAY';

export function coreCtes(s: DsSqlScope, rule: PairRule): Prisma.Sql {
  const pairCol = rule === 'DAY' ? Prisma.raw('k.pair_day') : Prisma.raw('k.pair_in');
  return Prisma.sql`
    lg AS (
      SELECT x.av_voucher_id AS vid, x.av_acc_year AS vyr, x.av_voucher_date AS vdate,
             x.av_branch_id AS br, x.av_ledger_id AS ledger_id, x.av_dr_cr AS dr_cr,
             x.av_amount AS amount, x.av_signed_amount AS signed
        FROM (${countedLegsSql(s, { from: s.from, upTo: s.to, ledgers: null })}) x),
    hd AS (SELECT DISTINCT vid, vyr FROM lg),
    hk AS (
      SELECT h.avh_voucher_id AS vid, h.avh_acc_year AS vyr, h.avh_voucher_type_id AS vt,
             h.avh_voucher_status AS st, h.avh_voucher_date AS vdate,
             CASE WHEN h.avh_voucher_status = 'CANCELLED' THEN h.avh_reversal_voucher_id
                  WHEN o.avh_voucher_status = 'CANCELLED' THEN o.avh_voucher_id END AS other_id,
             CASE WHEN h.avh_voucher_status = 'CANCELLED' THEN h.avh_reversal_acc_year
                  WHEN o.avh_voucher_status = 'CANCELLED' THEN o.avh_acc_year END AS other_yr,
             o.avh_voucher_id IS NOT NULL AS is_mirror
        FROM hd
        JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = hd.vid AND h.avh_acc_year = hd.vyr
        LEFT JOIN LATERAL (
          SELECT o.avh_voucher_id, o.avh_acc_year, o.avh_voucher_status
            FROM accounts.acc_voucher_header o
           WHERE o.avh_reversal_voucher_id = h.avh_voucher_id
             AND o.avh_reversal_acc_year = h.avh_acc_year
             AND o.avh_is_deleted = false
           LIMIT 1) o ON true),
    k AS (
      SELECT a.vid, a.vyr, a.vt, a.st, a.vdate, a.other_id, a.other_yr,
             CASE WHEN a.st = 'CANCELLED' THEN 'CANCELLED'
                  WHEN a.is_mirror THEN 'REVERSAL'
                  ELSE 'NORMAL' END AS kind,
             b.vid IS NOT NULL AS pair_in,
             b.vid IS NOT NULL AND b.vdate = a.vdate AS pair_day
        FROM hk a
        LEFT JOIN hk b ON b.vid = a.other_id AND b.vyr = a.other_yr),
    cl AS (
      SELECT lg.vid, lg.vyr, k.vt, lg.vdate, lg.br, lg.ledger_id, lg.dr_cr, lg.amount, lg.signed,
             k.kind
        FROM lg
        JOIN k ON k.vid = lg.vid AND k.vyr = lg.vyr
       WHERE NOT ${pairCol}
         AND (${s.voucherTypeId}::int IS NULL OR k.vt = ${s.voucherTypeId}::int))`;
}

/** The DRAFT headers of the scope dated in range (§6.3; ix_avh_pending). */
export function draftsSql(s: DsSqlScope): Prisma.Sql {
  return Prisma.sql`
      SELECT h.avh_voucher_id AS vid, h.avh_acc_year AS vyr, h.avh_voucher_type_id AS vt,
             h.avh_voucher_date AS vdate, h.avh_doc_amount AS doc_amount,
             h.avh_created_by AS created_by, h.avh_src_module AS src_module,
             h.avh_src_doc_type AS src_doc_type, h.avh_src_doc_id AS src_doc_id
        FROM accounts.acc_voucher_header h
       WHERE h.avh_company_id = ${s.companyId}::uuid
         AND h.avh_acc_year = ${s.accYear}::char(9)
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status = 'DRAFT'
         AND h.avh_voucher_date BETWEEN ${s.from}::date AND ${s.to}::date
         AND (${s.branchId}::uuid IS NULL OR h.avh_branch_id = ${s.branchId}::uuid)
         AND (${s.voucherTypeId}::int IS NULL OR h.avh_voucher_type_id = ${s.voucherTypeId}::int)`;
}

/** POSTED / CANCELLED headers of the scope dated in range with no live leg (§3.7). */
export function leglessSql(s: DsSqlScope): Prisma.Sql {
  return Prisma.sql`
      SELECT h.avh_voucher_id AS vid, h.avh_acc_year AS vyr, h.avh_voucher_type_id AS vt,
             h.avh_voucher_date AS vdate, h.avh_voucher_refno AS refno,
             h.avh_voucher_status AS status, h.avh_branch_id AS br
        FROM accounts.acc_voucher_header h
       WHERE h.avh_company_id = ${s.companyId}::uuid
         AND h.avh_acc_year = ${s.accYear}::char(9)
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
         AND h.avh_voucher_date BETWEEN ${s.from}::date AND ${s.to}::date
         AND (${s.branchId}::uuid IS NULL OR h.avh_branch_id = ${s.branchId}::uuid)
         AND (${s.voucherTypeId}::int IS NULL OR h.avh_voucher_type_id = ${s.voucherTypeId}::int)
         AND NOT EXISTS (
               SELECT 1 FROM accounts.acc_vouchers v
                WHERE v.av_voucher_id = h.avh_voucher_id AND v.av_acc_year = h.avh_acc_year
                  AND v.av_is_deleted = false)`;
}

/** Above this many numbers between a series' lowest and highest, the series is not expanded. */
export const GAP_SPAN_CAP = 100_000;

/**
 * §8.3 — per series (branch, type; company and year fixed), the numbers between
 * the lowest and highest number issued IN THE RANGE that no live non-draft
 * header holds; `deleted` when a soft-deleted header holds it. One row per
 * missing number.
 */
export function numberGapsSql(s: DsSqlScope): Prisma.Sql {
  return Prisma.sql`
    WITH s AS (
      SELECT h.avh_branch_id AS br, h.avh_voucher_type_id AS vt,
             MIN(h.avh_voucher_no) AS lo, MAX(h.avh_voucher_no) AS hi
        FROM accounts.acc_voucher_header h
       WHERE h.avh_company_id = ${s.companyId}::uuid
         AND h.avh_acc_year = ${s.accYear}::char(9)
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status <> 'DRAFT'
         AND h.avh_voucher_date BETWEEN ${s.from}::date AND ${s.to}::date
         AND (${s.branchId}::uuid IS NULL OR h.avh_branch_id = ${s.branchId}::uuid)
         AND (${s.voucherTypeId}::int IS NULL OR h.avh_voucher_type_id = ${s.voucherTypeId}::int)
       GROUP BY 1, 2
      HAVING MAX(h.avh_voucher_no) - MIN(h.avh_voucher_no) <= ${GAP_SPAN_CAP}),
    held AS (
      SELECT h.avh_branch_id AS br, h.avh_voucher_type_id AS vt, h.avh_voucher_no AS no,
             bool_or(NOT h.avh_is_deleted AND h.avh_voucher_status <> 'DRAFT') AS live,
             bool_or(h.avh_is_deleted) AS dead,
             (array_agg(h.avh_voucher_id ORDER BY h.avh_modified_on DESC NULLS LAST)
                FILTER (WHERE h.avh_is_deleted))[1] AS dead_id,
             (array_agg(h.avh_voucher_refno ORDER BY h.avh_modified_on DESC NULLS LAST)
                FILTER (WHERE h.avh_is_deleted))[1] AS dead_refno
        FROM accounts.acc_voucher_header h
        JOIN s ON s.br = h.avh_branch_id AND s.vt = h.avh_voucher_type_id
              AND h.avh_voucher_no BETWEEN s.lo AND s.hi
       WHERE h.avh_company_id = ${s.companyId}::uuid
         AND h.avh_acc_year = ${s.accYear}::char(9)
       GROUP BY 1, 2, 3)
    SELECT s.br, s.vt, s.lo, s.hi, g.n,
           COALESCE(held.dead, false) AS deleted, held.dead_id, held.dead_refno
      FROM s
     CROSS JOIN LATERAL generate_series(s.lo, s.hi) AS g(n)
      LEFT JOIN held ON held.br = s.br AND held.vt = s.vt AND held.no = g.n
     WHERE NOT COALESCE(held.live, false)`;
}
