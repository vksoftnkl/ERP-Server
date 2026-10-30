import { Prisma } from '@prisma/client';

/**
 * Notes 126 §4 — every leg on a CASH / BANK ledger, LABELLED with the tender it
 * moved by. The legs are the books (they are what the Trial Balance and every
 * ledger balance read); the tender rows (`acc_tender_detail`) only label them,
 * so the Day Book by tender always adds up to the cash and bank ledgers, and
 * what no row labels is the "money line with no tender" a user goes looking for.
 *
 * A row labels the ledger it names or its settlement ledger (a card / UPI
 * payment out leaves the bank while the row names the clearing ledger).
 *
 * A leg group (voucher, ledger, side) is labelled by the tender rows of the
 * voucher that COVERS it — the voucher itself, or for a reversal mirror the
 * original it undoes (sides flipped). A row covers a voucher when it names it
 * (`td_voucher_id`, or `td_src_doc_id` — the register, receipts, payments,
 * ExpV, the server's own 'VOUCHER' rows), when it is the document's own row
 * not claimed by another voucher (a bill's, a return's: `td_src_doc_id` = the
 * voucher's source), or — a re-tender's contra, sourced on the row it voided —
 * when it replaced that row, or is that row on the opposite side. The same rule
 * as `coverMoneyLines` (common/posting/money-lines.ts).
 *
 * Several rows on one group split it in proportion; rows short of the group
 * leave the rest UNLABELLED (tender_id NULL). A cancelled voucher's rows count
 * even when the cancel deleted them: its legs and its mirror's still stand.
 *
 * Columns: voucher_id, acc_year, voucher_date, voucher_type_id, refno,
 * branch_id, session_id, party_id, ledger_id, side, tender_id, tender_type_id,
 * amount (positive), signed (DR +, CR −), is_mirror, src_doc_type.
 */
export interface MoneyLinesScope {
  companyId: string;
  accYear: string;
  /** null = every branch. */
  branchId: string | null;
  /** Legs dated on or before. */
  upTo: string;
  /** Legs dated on or after; null = from the start of the year. */
  from: string | null;
  /** The voucher's till session. */
  sessionId: string | null;
}

export function labelledMoneyLinesSql(scope: MoneyLinesScope): Prisma.Sql {
  return Prisma.sql`
    WITH legs AS (
      SELECT h.avh_voucher_id AS vid, h.avh_acc_year AS y, h.avh_voucher_date AS d,
             h.avh_voucher_type_id AS type_id, h.avh_voucher_refno AS refno,
             h.avh_branch_id AS branch_id, h.avh_session_id AS session_id,
             h.avh_party_id AS party_id, h.avh_src_doc_type AS src_doc_type,
             v.av_ledger_id AS ledger_id, trim(v.av_dr_cr) AS side, sum(v.av_amount) AS amount,
             COALESCE(o.avh_voucher_id, h.avh_voucher_id) AS cover_vid,
             COALESCE(o.avh_src_doc_type, h.avh_src_doc_type) AS cover_src_type,
             COALESCE(o.avh_src_doc_id, h.avh_src_doc_id) AS cover_src_id,
             COALESCE(o.avh_voucher_status, h.avh_voucher_status) AS cover_status,
             (o.avh_voucher_id IS NOT NULL) AS is_mirror
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_vouchers v
          ON v.av_voucher_id = h.avh_voucher_id AND v.av_acc_year = h.avh_acc_year
         AND v.av_is_deleted = false
        JOIN accounts.acc_ledger_master l
          ON l.led_id = v.av_ledger_id AND upper(l.led_ledger_type) IN ('CASH', 'BANK')
        LEFT JOIN accounts.acc_voucher_header o
          ON o.avh_reversal_voucher_id = h.avh_voucher_id
         AND o.avh_reversal_acc_year = h.avh_acc_year
       WHERE h.avh_company_id = ${scope.companyId}::uuid
         AND h.avh_acc_year = ${scope.accYear}::char(9)
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
         AND (${scope.branchId}::uuid IS NULL OR h.avh_branch_id = ${scope.branchId}::uuid)
         AND (${scope.sessionId}::uuid IS NULL OR h.avh_session_id = ${scope.sessionId}::uuid)
         AND h.avh_voucher_date <= ${scope.upTo}::date
         AND (${scope.from}::date IS NULL OR h.avh_voucher_date >= ${scope.from}::date)
       GROUP BY h.avh_voucher_id, h.avh_acc_year, h.avh_voucher_date, h.avh_voucher_type_id,
                h.avh_voucher_refno, h.avh_branch_id, h.avh_session_id, h.avh_party_id,
                h.avh_src_doc_type, v.av_ledger_id, trim(v.av_dr_cr),
                o.avh_voucher_id, o.avh_src_doc_type, o.avh_src_doc_id, o.avh_voucher_status,
                h.avh_src_doc_id, h.avh_voucher_status
    ),
    labels AS (
      SELECT g.vid, g.ledger_id, g.side, t.td_tender_id AS tender_id,
             t.td_tender_type_id AS tender_type_id, sum(t.td_amount) AS amt
        FROM legs g
        JOIN accounts.acc_tender_detail t
          ON (t.td_tender_ledger_id = g.ledger_id OR t.td_settle_ledger_id = g.ledger_id)
         AND (t.td_is_deleted = false OR g.cover_status = 'CANCELLED')
         AND (
               ( trim(t.td_dr_cr) = CASE WHEN g.is_mirror
                                         THEN CASE g.side WHEN 'DR' THEN 'CR' ELSE 'DR' END
                                         ELSE g.side END
                 AND ( t.td_voucher_id = g.cover_vid
                       OR t.td_src_doc_id = g.cover_vid
                       OR (g.cover_src_type = 'SALE_BILL_RETENDER' AND t.td_replaces_id = g.cover_src_id)
                       OR (g.cover_src_type IS DISTINCT FROM 'SALE_BILL_RETENDER'
                           AND t.td_src_doc_id = g.cover_src_id AND t.td_voucher_id IS NULL) ) )
            OR ( g.cover_src_type = 'SALE_BILL_RETENDER' AND t.td_id = g.cover_src_id
                 AND trim(t.td_dr_cr) = CASE WHEN g.is_mirror THEN g.side
                                             ELSE CASE g.side WHEN 'DR' THEN 'CR' ELSE 'DR' END END )
             )
       GROUP BY 1, 2, 3, 4, 5
    ),
    att AS (
      SELECT g.*, lb.tender_id, lb.tender_type_id, lb.amt,
             sum(lb.amt) OVER (PARTITION BY g.vid, g.ledger_id, g.side) AS covered
        FROM legs g
        LEFT JOIN labels lb ON lb.vid = g.vid AND lb.ledger_id = g.ledger_id AND lb.side = g.side
    ),
    lines AS (
      SELECT vid, y, d, type_id, refno, branch_id, session_id, party_id, src_doc_type,
             ledger_id, side, is_mirror, tender_id, tender_type_id,
             CASE WHEN covered >= amount THEN round(amount * amt / covered, 2) ELSE amt END AS amount
        FROM att
       WHERE tender_id IS NOT NULL
      UNION ALL
      SELECT DISTINCT ON (vid, ledger_id, side)
             vid, y, d, type_id, refno, branch_id, session_id, party_id, src_doc_type,
             ledger_id, side, is_mirror, NULL::uuid, NULL::int,
             amount - COALESCE(covered, 0)
        FROM att
       WHERE COALESCE(covered, 0) < amount
    )
    SELECT vid::text AS voucher_id, y AS acc_year, to_char(d, 'YYYY-MM-DD') AS voucher_date,
           type_id AS voucher_type_id, refno, branch_id::text, session_id::text, party_id::text,
           src_doc_type, ledger_id::text, side, is_mirror, tender_id::text, tender_type_id,
           amount, CASE side WHEN 'DR' THEN amount ELSE -amount END AS signed
      FROM lines
     WHERE amount <> 0`;
}
