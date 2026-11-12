import { Prisma } from '@prisma/client';
import { SHADOW_DOC_TYPES } from './item-ledger.rules';

/**
 * The Item Ledger's SQL (plan 2026-11-11 §5.4). Every statement is built here,
 * from ONE chain of CTEs, so the Vouchers tab, the totals, the panes, the
 * Day-wise / Month-wise tabs and the export cannot disagree about what a row
 * is. Read-only; the service runs it inside a REPEATABLE READ, READ ONLY
 * transaction with `SET LOCAL plan_cache_mode = force_custom_plan`.
 *
 * The rows of `stock.stock_ledger` point at a stock voucher (`sml_src_doc_id`
 * = `svh_id`): a sale or purchase posts through a "shadow" voucher whose
 * `svh_link_src_*` names the bill. `sml_src_refno` already carries the bill
 * number, so only the enrichment of the page rows joins through the link.
 *
 * The fragments `ledgerScopeWhere`, `reportTypeCase` and `openingSql` are
 * exported for the Stock Summary (IL-37), so it uses the SAME in / out words.
 */

export interface LedgerSqlScope {
  companyId: string;
  branchId: string;
  itemId: string;
  from: string;
  to: string;
  godownId: string | null;
  /** null = all buckets. */
  bucket: string | null;
  lotId: string | null;
  /** Value at cost without tax (`_wot` columns). */
  wot: boolean;
  /** D17 — revaluation rows (opening and period) only at All godowns with Bucket = All or Saleable. */
  withRevaluations: boolean;
  /** Row filter: report type codes; empty = all. */
  types: string[];
  /** Row filter: false hides the reversed pairs that net to 0. */
  showReversed: boolean;
}

const MOVE_TXNS = Prisma.sql`('TRANSFER_OUT','TRANSFER_IN','BUCKET_OUT','BUCKET_IN')`;

/** The ledger's cost-value column for the chosen basis (a whitelisted identifier, never input). */
export function costValueCol(alias: string, wot: boolean): Prisma.Sql {
  return Prisma.raw(`${alias}.${wot ? 'sml_cost_value_wot' : 'sml_cost_value'}`);
}

function revalValueCol(alias: string, wot: boolean): Prisma.Sql {
  return Prisma.raw(`${alias}.${wot ? 'scr_value_wot' : 'scr_value'}`);
}

/**
 * The holding (D16): company, branch, item, not deleted, and the SCOPE filters
 * (godown, bucket, lot). Filters are left out rather than written `$x IS NULL
 * OR …`, so the plan never depends on a parameter's value.
 */
export function ledgerScopeWhere(alias: string, s: LedgerSqlScope): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`${a}.sml_company_id = ${s.companyId}::uuid
     AND ${a}.sml_branch_id = ${s.branchId}::uuid
     AND ${a}.sml_item_id = ${s.itemId}::uuid
     AND ${a}.sml_is_deleted = false
     ${s.godownId ? Prisma.sql`AND ${a}.sml_godown_id = ${s.godownId}::uuid` : Prisma.empty}
     ${s.bucket ? Prisma.sql`AND ${a}.sml_bucket = ${s.bucket}` : Prisma.empty}
     ${s.lotId ? Prisma.sql`AND ${a}.sml_lot_id = ${s.lotId}::uuid` : Prisma.empty}`;
}

function revalScopeWhere(alias: string, s: LedgerSqlScope): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`${a}.scr_company_id = ${s.companyId}::uuid
     AND ${a}.scr_branch_id = ${s.branchId}::uuid
     AND ${a}.scr_item_id = ${s.itemId}::uuid
     AND ${a}.scr_is_deleted = false
     ${s.lotId ? Prisma.sql`AND ${a}.scr_lot_id = ${s.lotId}::uuid` : Prisma.empty}`;
}

/**
 * §5.3 — the report type of one display row. `row` is a grp-shaped row
 * (src_kind, internal, gtxn, src_type); `voucher` the stock voucher joined for
 * TRANSFER_OUT rows only (branch outward vs godown transfer). The same table
 * as `reportTypeOf` in item-ledger.rules.ts, which the specs hold it to.
 */
export function reportTypeCase(row: string, voucher: string, branchId: string): Prisma.Sql {
  const r = Prisma.raw(row);
  const v = Prisma.raw(voucher);
  return Prisma.sql`CASE
      WHEN ${r}.src_kind = 'R' THEN 'REVALUED'
      WHEN ${r}.internal THEN CASE WHEN ${r}.gtxn = 'TRANSFER' THEN 'GODOWN_TRANSFER' ELSE 'BUCKET_MOVE' END
      WHEN ${r}.gtxn = 'OPENING' THEN 'OPENING'
      WHEN ${r}.gtxn = 'PURCHASE' THEN CASE ${r}.src_type WHEN 'GRN' THEN 'GRN'
                                                  WHEN 'SHORTAGE_RECEIPT' THEN 'SHORTAGE_RECEIPT'
                                                  ELSE 'PURCHASE' END
      WHEN ${r}.gtxn IN ('PURCHASE_RETURN','SALE','SALE_RETURN','DC_RETURN',
                         'ADJUST_PLUS','ADJUST_MINUS','DAMAGE') THEN ${r}.gtxn
      WHEN ${r}.gtxn = 'DC_ISSUE' THEN 'DC'
      WHEN ${r}.gtxn = 'PHYSICAL_PLUS' THEN 'COUNT_EXCESS'
      WHEN ${r}.gtxn = 'PHYSICAL_MINUS' THEN 'COUNT_SHORT'
      WHEN ${r}.gtxn = 'EXPIRY_WRITEOFF' THEN 'EXPIRED'
      WHEN ${r}.gtxn = 'SAMPLE_ISSUE' THEN 'SAMPLE'
      WHEN ${r}.gtxn = 'GIFT_ISSUE' THEN 'GIFT'
      WHEN ${r}.gtxn IN ('BUCKET_OUT','BUCKET_IN') THEN 'BUCKET_MOVE'
      WHEN ${r}.gtxn IN ('REPACK_IN','REPACK_OUT') THEN 'REPACK'
      WHEN ${r}.gtxn = 'TRANSFER_IN' THEN CASE WHEN ${r}.src_type = 'TRANSFER_IN' THEN 'BRANCH_IN'
                                              ELSE 'GODOWN_TRANSFER' END
      WHEN ${r}.gtxn = 'TRANSFER_OUT' THEN
           CASE WHEN ${v}.svh_to_branch_id IS NOT NULL AND ${v}.svh_to_branch_id <> ${branchId}::uuid
                THEN 'BRANCH_OUT' ELSE 'GODOWN_TRANSFER' END
      ELSE ${r}.gtxn END`;
}

/**
 * The opening (D12): Σ every ledger row of the holding dated before `from`,
 * all years — an index-only range scan on `stock.ix_sml_item_ledger` (every
 * column read here is in its key or INCLUDE list). `lots` = lots whose
 * opening quantity is not 0. `rv` = revaluation value before `from` (D17).
 * `after_q` = the holding's rows dated after `to` (the tie check's
 * future-dated documents), the same index.
 */
export function openingSql(s: LedgerSqlScope, withAfter: boolean): Prisma.Sql {
  return Prisma.sql`
    WITH ol AS (
      SELECT l.sml_lot_id AS lot,
             SUM(l.sml_signed_base_qty) AS q,
             SUM(l.sml_direction * ${costValueCol('l', s.wot)}) AS v
        FROM stock.stock_ledger l
       WHERE ${ledgerScopeWhere('l', s)}
         AND l.sml_doc_date < ${s.from}::date
       GROUP BY l.sml_lot_id)
    SELECT COALESCE((SELECT SUM(q) FROM ol), 0) AS q,
           COALESCE((SELECT SUM(v) FROM ol), 0) AS v,
           (SELECT COUNT(*) FROM ol WHERE q <> 0)::int AS lots,
           ${
             s.withRevaluations
               ? Prisma.sql`(SELECT COALESCE(SUM(${revalValueCol('r', s.wot)}), 0)
                               FROM stock.stock_cost_revaluation r
                              WHERE ${revalScopeWhere('r', s)} AND r.scr_doc_date < ${s.from}::date)`
               : Prisma.sql`0::numeric`
           } AS rv,
           ${
             withAfter
               ? Prisma.sql`(SELECT COALESCE(SUM(a.sml_signed_base_qty), 0)
                               FROM stock.stock_ledger a
                              WHERE ${ledgerScopeWhere('a', s)} AND a.sml_doc_date > ${s.to}::date)`
               : Prisma.sql`0::numeric`
           } AS after_q`;
}

/**
 * The chain, `WITH led … fin` — one display row per document × type × godown ×
 * lot × bucket × reversal, in scope, dated `from` … `to`:
 *
 *  led    the holding's ledger rows in the period (ix_sml_item_date);
 *  mv     both legs of a transfer / bucket move inside the scope → internal (D15);
 *  grp    the display rows; an internal pair is ONE row with no net quantity;
 *  rgrp   revaluation rows (D17), one per stock_cost_revaluation row, value only;
 *  typed  + the report type (§5.3), the pair key `gk` (an original and its
 *           reversal share it; "C" collation, as it is only ever compared for
 *           equality and a locale-aware sort of it cost ~30 ms on 3.5k rows),
 *           the other leg of a one-leg move;
 *  paired + the original of a reversal / the reversal of an original, and
 *           whether the pair nets to 0 (quantity AND value);
 *  st     + AMENDED vs CANCELLED: a reversed shadow is AMENDED when a later,
 *           non-draft shadow of the same business document exists (D14);
 *  fin    + state, kind, the sort keys (a reversal sorts right after its
 *           original: it carries the original's date and time) and `shown`
 *           (the row filters — types, showReversed — which never move a balance).
 */
export function ledgerChain(s: LedgerSqlScope): Prisma.Sql {
  const typesAll = s.types.length === 0;
  const typesList = typesAll ? ['-'] : s.types;
  return Prisma.sql`
    WITH led AS (
      SELECT l.sml_id,
             l.sml_src_module::text AS src_module,
             l.sml_src_doc_type::text AS src_type,
             l.sml_src_doc_id AS doc_id,
             COALESCE(l.sml_src_acc_year, l.sml_acc_year) AS src_year,
             l.sml_line_no AS line_no, l.sml_split_no AS split_no,
             l.sml_txn_type::text AS txn, l.sml_is_reversal AS is_rev,
             l.sml_godown_id AS godown, l.sml_lot_id AS lot, l.sml_bucket::text AS bucket,
             l.sml_doc_date AS d, l.sml_doc_datetime AS dt, l.sml_posted_on AS pon,
             l.sml_signed_base_qty AS sq,
             l.sml_direction * ${costValueCol('l', s.wot)} AS sv,
             (CASE WHEN l.sml_is_reversal THEN -l.sml_direction ELSE l.sml_direction END)::int AS nat_dir,
             l.sml_base_qty + l.sml_free_base_qty AS gq,
             ${costValueCol('l', s.wot)} AS gv,
             l.sml_free_base_qty AS fq, l.sml_base_qty AS bq,
             l.sml_doc_rate * l.sml_qty AS doc_amt,
             l.sml_party_id AS party_id, l.sml_created_by AS by_user, l.sml_narration AS narration,
             l.sml_src_refno::text AS refno, l.sml_batch_no::text AS batch_no, l.sml_expiry_date AS expiry
        FROM stock.stock_ledger l
       WHERE ${ledgerScopeWhere('l', s)}
         AND l.sml_doc_date BETWEEN ${s.from}::date AND ${s.to}::date),
    mv AS (
      SELECT doc_id, src_year, line_no, split_no, lot, is_rev
        FROM led
       WHERE txn IN ${MOVE_TXNS}
       GROUP BY doc_id, src_year, line_no, split_no, lot, is_rev
      HAVING COUNT(DISTINCT nat_dir) = 2),
    per AS (
      SELECT led.*, (mv.doc_id IS NOT NULL) AS internal
        FROM led
        LEFT JOIN mv
          ON led.txn IN ${MOVE_TXNS}
         AND mv.doc_id = led.doc_id AND mv.src_year = led.src_year
         AND mv.line_no = led.line_no AND mv.split_no = led.split_no
         AND mv.lot = led.lot AND mv.is_rev = led.is_rev),
    grp AS (
      SELECT 'L'::text AS src_kind, src_module, src_type, doc_id, src_year, is_rev, internal,
             CASE WHEN internal THEN CASE WHEN txn LIKE 'TRANSFER%' THEN 'TRANSFER' ELSE 'BUCKET' END
                  ELSE txn END AS gtxn,
             CASE WHEN internal THEN NULL ELSE godown END AS gdown,
             lot,
             CASE WHEN internal THEN NULL ELSE bucket END AS gbucket,
             MIN(d) AS d, MIN(dt) AS dt, MIN(pon) AS pon,
             (array_agg(sml_id ORDER BY pon, sml_id))[1] AS row_id,
             (array_agg(line_no ORDER BY pon, sml_id))[1] AS line_no,
             (array_agg(split_no ORDER BY pon, sml_id))[1] AS split_no,
             CASE WHEN internal THEN 0 ELSE MIN(nat_dir) END AS nat_dir,
             SUM(sq) AS sq, SUM(sv) AS sv, SUM(gq) AS gq, SUM(gv) AS gv,
             SUM(CASE WHEN NOT internal OR nat_dir = -1 THEN fq ELSE 0 END) AS fq,
             SUM(CASE WHEN internal AND nat_dir = -1 THEN gq ELSE 0 END) AS moved,
             SUM(doc_amt) AS doc_amt, SUM(bq) AS bq,
             (array_agg(godown) FILTER (WHERE nat_dir = -1))[1] AS from_godown,
             (array_agg(godown) FILTER (WHERE nat_dir = 1))[1] AS to_godown,
             (array_agg(bucket) FILTER (WHERE nat_dir = -1))[1] AS from_bucket,
             (array_agg(bucket) FILTER (WHERE nat_dir = 1))[1] AS to_bucket,
             (array_agg(party_id) FILTER (WHERE party_id IS NOT NULL))[1] AS party_id,
             (array_agg(by_user ORDER BY pon, sml_id))[1] AS by_user,
             (array_agg(narration ORDER BY pon, sml_id) FILTER (WHERE COALESCE(narration, '') <> ''))[1] AS narration,
             (array_agg(refno ORDER BY pon, sml_id))[1] AS refno,
             (array_agg(batch_no ORDER BY pon, sml_id) FILTER (WHERE COALESCE(batch_no, '') <> ''))[1] AS batch_no,
             MIN(expiry) AS expiry,
             NULL::uuid AS rev_of
        FROM per
       GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
    rgrp AS (
      SELECT 'R'::text, r.scr_src_module::text, r.scr_src_doc_type::text, r.scr_src_doc_id,
             r.scr_src_acc_year, r.scr_is_reversal, false, 'REVALUED'::text, NULL::uuid, r.scr_lot_id,
             NULL::text, r.scr_doc_date, r.scr_doc_datetime, r.scr_created_on, r.scr_id,
             NULL::int, NULL::int, 0,
             0::numeric, ${revalValueCol('r', s.wot)}, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
             0::numeric, 0::numeric,
             NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::uuid,
             r.scr_created_by, r.scr_narration, r.scr_src_refno::text, NULL::text, NULL::date,
             r.scr_reverses_id
        FROM stock.stock_cost_revaluation r
       WHERE ${s.withRevaluations ? Prisma.sql`true` : Prisma.sql`false`}
         AND ${revalScopeWhere('r', s)}
         AND r.scr_doc_date BETWEEN ${s.from}::date AND ${s.to}::date),
    allg AS (SELECT * FROM grp UNION ALL SELECT * FROM rgrp),
    typed AS (
      SELECT a.*,
             ${reportTypeCase('a', 'tv', s.branchId)} AS rtype,
             (CASE WHEN a.src_kind = 'R' THEN 'R|' || COALESCE(a.rev_of, a.row_id)::text
                   ELSE format('L|%s|%s|%s|%s|%s|%s', a.doc_id, a.src_year, a.gtxn, a.gdown, a.lot, a.gbucket)
              END) COLLATE "C" AS gk,
             ol.sml_bucket::text AS other_bucket,
             ol.sml_godown_id AS other_godown
        FROM allg a
        LEFT JOIN stock.stock_voucher tv
          ON a.src_kind = 'L' AND a.gtxn = 'TRANSFER_OUT'
         AND tv.svh_id = a.doc_id AND tv.svh_acc_year = a.src_year
        LEFT JOIN LATERAL (
          SELECT o.sml_bucket, o.sml_godown_id
            FROM stock.stock_ledger o
           WHERE a.src_kind = 'L' AND a.gtxn IN ${MOVE_TXNS}
             AND o.sml_src_doc_id = a.doc_id AND o.sml_src_doc_type = a.src_type
             AND COALESCE(o.sml_src_acc_year, o.sml_acc_year) = a.src_year
             AND o.sml_line_no = a.line_no AND o.sml_split_no = a.split_no AND o.sml_lot_id = a.lot
             AND o.sml_is_reversal = a.is_rev AND o.sml_is_deleted = false
             AND o.sml_txn_type = CASE a.gtxn WHEN 'TRANSFER_OUT' THEN 'TRANSFER_IN'
                                              WHEN 'TRANSFER_IN' THEN 'TRANSFER_OUT'
                                              WHEN 'BUCKET_OUT' THEN 'BUCKET_IN'
                                              ELSE 'BUCKET_OUT' END
           LIMIT 1) ol ON true),
    og AS (SELECT gk, sq, sv, dt, pon, row_id, refno FROM typed WHERE NOT is_rev),
    rv AS (SELECT gk, sq, sv, pon, row_id, by_user, narration FROM typed WHERE is_rev),
    paired AS (
      SELECT t.*,
             o.dt AS o_dt, o.pon AS o_pon, o.row_id AS o_row, o.refno AS o_refno,
             r.pon AS r_pon, r.row_id AS r_row, r.by_user AS r_by, r.narration AS r_narr,
             CASE WHEN t.is_rev THEN o.row_id IS NOT NULL AND o.sq + t.sq = 0 AND o.sv + t.sv = 0
                  ELSE r.row_id IS NOT NULL AND r.sq + t.sq = 0 AND r.sv + t.sv = 0 END AS nets_zero
        FROM typed t
        LEFT JOIN og o ON t.is_rev AND o.gk = t.gk
        LEFT JOIN rv r ON NOT t.is_rev AND r.gk = t.gk),
    st AS (
      SELECT p.*,
             CASE WHEN NOT (p.is_rev OR p.r_row IS NOT NULL) THEN false
                  WHEN p.src_kind = 'L' THEN EXISTS (
                    SELECT 1
                      FROM stock.stock_voucher v
                      JOIN stock.stock_voucher w
                        ON w.svh_link_src_doc_id = v.svh_link_src_doc_id
                       AND w.svh_link_src_acc_year = v.svh_link_src_acc_year
                       AND w.svh_link_src_doc_type = v.svh_link_src_doc_type
                       AND w.svh_is_deleted = false AND w.svh_id <> v.svh_id
                       AND w.svh_created_on > v.svh_created_on
                       AND w.svh_status <> 'DRAFT'
                     WHERE v.svh_id = p.doc_id AND v.svh_acc_year = p.src_year
                       AND v.svh_link_src_doc_type IN (${Prisma.join([...SHADOW_DOC_TYPES])}))
                  ELSE EXISTS (
                    SELECT 1 FROM stock.stock_cost_revaluation x
                     WHERE x.scr_src_doc_id = p.doc_id AND x.scr_src_acc_year = p.src_year
                       AND x.scr_is_reversal = false AND x.scr_is_deleted = false
                       AND x.scr_created_on > COALESCE(p.o_pon, p.pon))
             END AS amended
        FROM paired p),
    fin AS (
      SELECT s.*,
             CASE WHEN s.is_rev THEN 'REVERSAL'
                  WHEN s.r_row IS NOT NULL THEN CASE WHEN s.amended THEN 'AMENDED' ELSE 'CANCELLED' END
                  ELSE 'LIVE' END AS state,
             CASE WHEN s.src_kind = 'R' THEN 'VALUE'
                  WHEN s.internal THEN 'INTERNAL'
                  WHEN s.nat_dir = 1 THEN 'IN'
                  ELSE 'OUT' END AS kind,
             COALESCE(s.o_dt, s.dt) AS k_dt,
             COALESCE(s.o_pon, s.pon) AS k_pon,
             COALESCE(s.o_row, s.row_id) AS k_row,
             ((${typesAll}::boolean OR s.rtype = ANY(${typesList}::text[]))
              AND (${s.showReversed}::boolean OR NOT s.nets_zero)) AS shown
        FROM st s)`;
}

/** Posting order (D12 / §5.4): date, time, posted time, original before its reversal. */
const POSTING_ORDER = Prisma.sql`f.d, f.k_dt, f.k_pon, f.k_row, f.is_rev, f.row_id`;

/**
 * One page of the Vouchers tab (or every row, for /export) — `seq` and the
 * running balance are computed over ALL rows in ascending posting order before
 * the row filters and the page are applied, so `order=desc` and a type filter
 * only change which rows are listed, never a balance. The enrichment joins
 * (bill, supplier invoice, names, transit) run on the page rows only.
 */
export function pageSql(
  s: LedgerSqlScope,
  opts: { order: 'asc' | 'desc'; limit: number; offset: number },
): Prisma.Sql {
  const dir = Prisma.raw(opts.order === 'desc' ? 'DESC' : 'ASC');
  return Prisma.sql`
    ${ledgerChain(s)},
    seqd AS (
      SELECT f.*,
             ROW_NUMBER() OVER w AS seq,
             SUM(f.sq) OVER w AS run_q,
             SUM(f.sv) OVER w AS run_v
        FROM fin f
      WINDOW w AS (ORDER BY ${POSTING_ORDER} ROWS UNBOUNDED PRECEDING)),
    pg AS (
      SELECT * FROM seqd WHERE shown ORDER BY seq ${dir} LIMIT ${opts.limit} OFFSET ${opts.offset})
    SELECT pg.seq::int AS seq, pg.row_id, pg.src_kind, pg.src_module, pg.src_type, pg.doc_id,
           btrim(pg.src_year) AS src_year, pg.is_rev, pg.internal, pg.gtxn, pg.rtype, pg.kind, pg.state,
           pg.amended, pg.nets_zero,
           pg.d::text AS d,
           to_char(pg.dt AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS t_doc,
           to_char(pg.pon AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS t_post,
           to_char(pg.pon AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS posted_at,
           to_char(pg.o_pon AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS o_posted_at,
           to_char(pg.r_pon AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS r_posted_at,
           pg.refno, pg.o_refno,
           pg.sq, pg.sv, pg.gq, pg.gv, pg.fq, pg.moved, pg.doc_amt, pg.bq, pg.run_q, pg.run_v,
           pg.gdown, gd.gdl_name AS gdown_name,
           pg.from_godown, fg.gdl_name AS from_godown_name,
           pg.to_godown, tg.gdl_name AS to_godown_name,
           pg.other_godown, xg.gdl_name AS other_godown_name,
           pg.gbucket, pg.from_bucket, pg.to_bucket, pg.other_bucket,
           pg.lot, COALESCE(lt.slt_batch_no, pg.batch_no) AS batch_no,
           COALESCE(lt.slt_expiry_date, pg.expiry)::text AS expiry,
           u.usr_login_name AS by_login, ru.usr_login_name AS r_by_login,
           pg.narration, pg.r_narr,
           v.svh_voucher_type AS voucher_type, v.svh_refno AS voucher_refno,
           v.svh_link_src_doc_type AS link_type, v.svh_link_src_doc_id AS link_id,
           btrim(v.svh_link_src_acc_year) AS link_year, v.svh_branch_id AS voucher_branch,
           v.svh_to_branch_id AS to_branch, v.svh_remarks AS remarks,
           rs.srm_name AS reason_name,
           tb.br_name AS to_branch_name, ob.br_name AS from_branch_name,
           sb.sb_cust_id, sb.sb_cust_name,
           COALESCE(sb.sb_cust_id, pg.party_id, pi.pi_supplier_id) AS party_id,
           pl.led_name AS party_name,
           pi.pi_supplier_inv_no, grn.grn_supplier_inv_no,
           tr.status AS transit_status, tr.received_on AS transit_received_on
      FROM pg
      LEFT JOIN stock.stock_voucher v
             ON pg.src_kind = 'L' AND v.svh_id = pg.doc_id AND v.svh_acc_year = pg.src_year
      LEFT JOIN sales.sale_bill sb
             ON v.svh_link_src_doc_type = 'SALE_BILL'
            AND sb.sb_id = v.svh_link_src_doc_id AND sb.sb_acc_year = v.svh_link_src_acc_year
      LEFT JOIN purchase.pur_invoice pi
             ON pi.pi_id = CASE WHEN pg.src_kind = 'R' AND pg.src_type = 'PURCHASE_BILL' THEN pg.doc_id
                                WHEN v.svh_link_src_doc_type = 'PURCHASE_BILL' THEN v.svh_link_src_doc_id END
            AND pi.pi_acc_year = CASE WHEN pg.src_kind = 'R' THEN pg.src_year
                                      ELSE v.svh_link_src_acc_year END
      LEFT JOIN purchase.pur_grn grn
             ON v.svh_link_src_doc_type = 'GRN'
            AND grn.grn_id = v.svh_link_src_doc_id AND grn.grn_acc_year = v.svh_link_src_acc_year
      LEFT JOIN accounts.acc_ledger_master pl
             ON pl.led_id = COALESCE(sb.sb_cust_id, pg.party_id, pi.pi_supplier_id)
      LEFT JOIN stock.stock_reason_master rs ON rs.srm_id = v.svh_reason_id
      LEFT JOIN public.branch_master tb ON tb.br_id = v.svh_to_branch_id
      LEFT JOIN stock.stock_voucher ov
             ON v.svh_voucher_type = 'TRANSFER_IN' AND v.svh_link_src_doc_type = 'STOCK_VOUCHER'
            AND ov.svh_id = v.svh_link_src_doc_id AND ov.svh_acc_year = v.svh_link_src_acc_year
      LEFT JOIN public.branch_master ob ON ob.br_id = ov.svh_branch_id
      LEFT JOIN LATERAL (
        SELECT CASE WHEN bool_and(t.stt_status = 'RECEIVED') THEN 'RECEIVED'
                    WHEN bool_and(t.stt_status = 'CANCELLED') THEN 'CANCELLED'
                    WHEN bool_or(t.stt_status = 'PARTIAL') OR SUM(t.stt_received_qty) > 0 THEN 'PARTIAL'
                    ELSE 'IN_TRANSIT' END AS status,
               (MAX(t.stt_received_on) AT TIME ZONE 'Asia/Kolkata')::date::text AS received_on
          FROM stock.stock_transit t
         WHERE pg.rtype = 'BRANCH_OUT'
           AND t.stt_out_voucher_id = pg.doc_id AND t.stt_out_acc_year = pg.src_year
           AND t.stt_item_id = ${s.itemId}::uuid AND t.stt_is_deleted = false
        HAVING COUNT(*) > 0) tr ON true
      LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = pg.gdown
      LEFT JOIN inventory.godown_locations fg ON fg.gdl_id = pg.from_godown
      LEFT JOIN inventory.godown_locations tg ON tg.gdl_id = pg.to_godown
      LEFT JOIN inventory.godown_locations xg ON xg.gdl_id = pg.other_godown
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = pg.lot
      LEFT JOIN public.user_master u ON u.usr_id::text = pg.by_user
      LEFT JOIN public.user_master ru ON ru.usr_id::text = pg.r_by
     ORDER BY pg.seq ${dir}`;
}

/**
 * The aggregates of the Vouchers tab in ONE statement, one `part` per kind of
 * answer:
 *   S  one row: counts and sums (`q_all` / `v_all` over every row → closing;
 *      the rest over the rows SHOWN → the Period total);
 *   B  By voucher type: per type × pair class, rows shown;
 *   T  the Received / Issued tiles: LIVE rows shown, per type × kind (× the
 *      other bucket of a one-leg bucket move);
 *   C  the Cancelled · Amended tile: every reversed original in scope,
 *      whatever the row filters (the tick hides them, the tile still counts).
 */
export function summarySql(s: LedgerSqlScope): Prisma.Sql {
  const docKey = Prisma.sql`(f.src_type || '|' || COALESCE(f.refno, f.doc_id::text))`;
  return Prisma.sql`
    ${ledgerChain(s)}
    SELECT 'S'::text AS part, NULL::text AS rtype, NULL::text AS cls, NULL::text AS kind,
           NULL::text AS ob, NULL::text AS doc_no, NULL::text[] AS kinds,
           COUNT(*)::int AS n_all,
           (COUNT(*) FILTER (WHERE f.shown))::int AS n_shown,
           (COUNT(DISTINCT ${docKey}) FILTER (WHERE f.shown))::int AS docs,
           (COUNT(*) FILTER (WHERE f.shown AND f.kind = 'INTERNAL' AND f.state <> 'REVERSAL'))::int AS n_internal,
           (COUNT(*) FILTER (WHERE f.shown AND f.state IN ('CANCELLED', 'AMENDED')))::int AS n_pairs,
           (COUNT(*) FILTER (WHERE f.shown AND f.kind = 'VALUE'))::int AS n_reval,
           COALESCE(SUM(f.sq), 0) AS q_all,
           COALESCE(SUM(f.sv), 0) AS v_all,
           COALESCE(SUM(f.sq) FILTER (WHERE f.shown AND f.kind = 'IN'), 0) AS q_in,
           COALESCE(-SUM(f.sq) FILTER (WHERE f.shown AND f.kind = 'OUT'), 0) AS q_out,
           COALESCE(SUM(f.sv) FILTER (WHERE f.shown AND f.kind <> 'OUT'), 0) AS v_in,
           COALESCE(-SUM(f.sv) FILTER (WHERE f.shown AND f.kind = 'OUT'), 0) AS v_out,
           NULL::numeric AS moved, NULL::numeric AS pair_q
      FROM fin f
    UNION ALL
    SELECT 'B', f.rtype,
           CASE WHEN f.state = 'LIVE' THEN 'LIVE' WHEN f.amended THEN 'AMENDED' ELSE 'CANCELLED' END,
           NULL, NULL, NULL, array_agg(DISTINCT f.kind),
           COUNT(*)::int, COUNT(*)::int, COUNT(DISTINCT ${docKey})::int, 0, 0, 0,
           COALESCE(SUM(f.sq), 0), COALESCE(SUM(f.sv), 0),
           SUM(f.sq) FILTER (WHERE f.kind = 'IN'),
           -SUM(f.sq) FILTER (WHERE f.kind = 'OUT'),
           SUM(f.sv) FILTER (WHERE f.kind <> 'OUT'),
           -SUM(f.sv) FILTER (WHERE f.kind = 'OUT'),
           SUM(f.moved) FILTER (WHERE NOT f.is_rev),
           SUM(f.gq) FILTER (WHERE NOT f.is_rev AND f.kind IN ('IN', 'OUT'))
      FROM fin f
     WHERE f.shown
     GROUP BY 2, 3
    UNION ALL
    SELECT 'T', f.rtype, NULL, f.kind,
           CASE WHEN f.rtype = 'BUCKET_MOVE' AND f.kind <> 'INTERNAL' THEN f.other_bucket END,
           NULL, NULL,
           COUNT(*)::int, COUNT(*)::int, COUNT(DISTINCT ${docKey})::int, 0, 0, 0,
           0, 0, NULL, NULL, NULL, NULL, NULL, NULL
      FROM fin f
     WHERE f.shown AND f.state = 'LIVE' AND f.kind IN ('IN', 'OUT')
     GROUP BY 2, 4, 5
    UNION ALL
    SELECT DISTINCT 'C', NULL::text, f.state, NULL::text, NULL::text, COALESCE(f.refno, ''),
           NULL::text[], 0, 0, 0, 0, 0, 0, 0::numeric, 0::numeric,
           NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
      FROM fin f
     WHERE f.state IN ('CANCELLED', 'AMENDED')`;
}

/**
 * Day-wise (`grain` day) and Month-wise (`grain` month) over the same chain.
 * `q_all` / `v_all` cover every row (the closing chain); the other sums only
 * the rows shown, as the Period total does.
 */
export function periodSql(s: LedgerSqlScope, grain: 'day' | 'month'): Prisma.Sql {
  const key = grain === 'day' ? Prisma.sql`f.d::text` : Prisma.sql`to_char(f.d, 'YYYY-MM')`;
  return Prisma.sql`
    ${ledgerChain(s)}
    SELECT ${key} AS k,
           (COUNT(DISTINCT (f.src_type || '|' || COALESCE(f.refno, f.doc_id::text))) FILTER (WHERE f.shown))::int AS docs,
           COUNT(*)::int AS n,
           COALESCE(SUM(f.sq), 0) AS q_all,
           COALESCE(SUM(f.sv), 0) AS v_all,
           COALESCE(SUM(f.sq) FILTER (WHERE f.shown AND f.kind = 'IN'), 0) AS q_in,
           COALESCE(-SUM(f.sq) FILTER (WHERE f.shown AND f.kind = 'OUT'), 0) AS q_out,
           COALESCE(SUM(f.sv) FILTER (WHERE f.shown AND f.kind <> 'OUT'), 0) AS v_in,
           COALESCE(-SUM(f.sv) FILTER (WHERE f.shown AND f.kind = 'OUT'), 0) AS v_out
      FROM fin f
     GROUP BY 1
     ORDER BY 1`;
}

/** Stock now (IL-24): the item's balance rows at the branch, in scope or not. */
export function stockNowSql(s: LedgerSqlScope): Prisma.Sql {
  const inScope = Prisma.sql`(true
      ${s.godownId ? Prisma.sql`AND b.sbl_godown_id = ${s.godownId}::uuid` : Prisma.empty}
      ${s.bucket ? Prisma.sql`AND b.sbl_bucket = ${s.bucket}` : Prisma.empty}
      ${s.lotId ? Prisma.sql`AND b.sbl_lot_id = ${s.lotId}::uuid` : Prisma.empty})`;
  return Prisma.sql`
    SELECT b.sbl_godown_id AS godown_id, g.gdl_name AS godown_name, b.sbl_bucket::text AS bucket,
           b.sbl_lot_id AS lot_id,
           COALESCE(NULLIF(lt.slt_batch_no, ''), NULLIF(b.sbl_batch_no, '')) AS batch_no,
           COALESCE(lt.slt_expiry_date, b.sbl_expiry_date)::text AS expiry,
           b.sbl_on_hand_qty AS on_hand, b.sbl_reserved_qty AS reserved,
           b.sbl_transit_in_qty AS transit_in,
           ${Prisma.raw(s.wot ? 'b.sbl_avg_cost_rate_wot' : 'b.sbl_avg_cost_rate')} AS cost_rate,
           ${Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value')} AS value,
           ${inScope} AS in_scope
      FROM stock.stock_balance b
      LEFT JOIN inventory.godown_locations g ON g.gdl_id = b.sbl_godown_id
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = b.sbl_lot_id
     WHERE b.sbl_company_id = ${s.companyId}::uuid
       AND b.sbl_branch_id = ${s.branchId}::uuid
       AND b.sbl_item_id = ${s.itemId}::uuid
       AND b.sbl_is_deleted = false
       AND (b.sbl_on_hand_qty <> 0 OR b.sbl_reserved_qty <> 0 OR b.sbl_transit_in_qty <> 0)
     ORDER BY in_scope DESC, g.gdl_sort NULLS LAST, g.gdl_name, b.sbl_bucket,
              COALESCE(lt.slt_expiry_date, b.sbl_expiry_date) NULLS LAST,
              COALESCE(NULLIF(lt.slt_batch_no, ''), NULLIF(b.sbl_batch_no, '')) NULLS LAST, b.sbl_lot_id`;
}

/**
 * D17's note: the revaluation rows a godown / bucket choice leaves out. With
 * them out, the opening drops every one dated before `from` (openingSql's `rv`)
 * and the period every one in `from` … `to` — so the count is all of them up to
 * `to`, on the same scope (lot included) as those two.
 */
export function revaluationsLeftOutSql(s: LedgerSqlScope): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(*)::int AS n
      FROM stock.stock_cost_revaluation r
     WHERE ${revalScopeWhere('r', s)}
       AND r.scr_doc_date <= ${s.to}::date`;
}

/**
 * /options' `types`: the (txn type, source doc type) pairs this item has at
 * this branch, all time, and for TRANSFER_OUT whether any went to another
 * branch / stayed in it. Mapped to report types by `reportTypeOf`.
 */
export function optionTypesSql(companyId: string, branchId: string, itemId: string): Prisma.Sql {
  return Prisma.sql`
    WITH t AS (
      SELECT DISTINCT l.sml_txn_type::text AS txn, l.sml_src_doc_type::text AS src_type
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${companyId}::uuid AND l.sml_branch_id = ${branchId}::uuid
         AND l.sml_item_id = ${itemId}::uuid AND l.sml_is_deleted = false)
    SELECT t.txn, t.src_type,
           CASE WHEN t.txn = 'TRANSFER_OUT' THEN EXISTS (
             SELECT 1 FROM stock.stock_ledger l
               JOIN stock.stock_voucher v
                 ON v.svh_id = l.sml_src_doc_id
                AND v.svh_acc_year = COALESCE(l.sml_src_acc_year, l.sml_acc_year)
              WHERE l.sml_company_id = ${companyId}::uuid AND l.sml_branch_id = ${branchId}::uuid
                AND l.sml_item_id = ${itemId}::uuid AND l.sml_is_deleted = false
                AND l.sml_txn_type = 'TRANSFER_OUT'
                AND v.svh_to_branch_id IS NOT NULL AND v.svh_to_branch_id <> ${branchId}::uuid)
           ELSE false END AS has_branch_out,
           CASE WHEN t.txn = 'TRANSFER_OUT' THEN EXISTS (
             SELECT 1 FROM stock.stock_ledger l
               JOIN stock.stock_voucher v
                 ON v.svh_id = l.sml_src_doc_id
                AND v.svh_acc_year = COALESCE(l.sml_src_acc_year, l.sml_acc_year)
              WHERE l.sml_company_id = ${companyId}::uuid AND l.sml_branch_id = ${branchId}::uuid
                AND l.sml_item_id = ${itemId}::uuid AND l.sml_is_deleted = false
                AND l.sml_txn_type = 'TRANSFER_OUT'
                AND (v.svh_to_branch_id IS NULL OR v.svh_to_branch_id = ${branchId}::uuid))
           ELSE false END AS has_godown_out,
           false AS is_reval
      FROM t
    UNION ALL
    SELECT 'REVALUED', 'PURCHASE_BILL', false, false, true
     WHERE EXISTS (SELECT 1 FROM stock.stock_cost_revaluation r
                    WHERE r.scr_company_id = ${companyId}::uuid AND r.scr_branch_id = ${branchId}::uuid
                      AND r.scr_item_id = ${itemId}::uuid AND r.scr_is_deleted = false)`;
}
