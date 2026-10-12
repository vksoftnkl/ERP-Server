"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAP_SPAN_CAP = void 0;
exports.coreCtes = coreCtes;
exports.draftsSql = draftsSql;
exports.leglessSql = leglessSql;
exports.numberGapsSql = numberGapsSql;
const client_1 = require("@prisma/client");
const voucher_books_sql_1 = require("../common/voucher-books.sql");
function coreCtes(s, rule) {
    const pairCol = rule === 'DAY' ? client_1.Prisma.raw('k.pair_day') : client_1.Prisma.raw('k.pair_in');
    return client_1.Prisma.sql `
    lg AS (
      SELECT x.av_voucher_id AS vid, x.av_acc_year AS vyr, x.av_voucher_date AS vdate,
             x.av_branch_id AS br, x.av_ledger_id AS ledger_id, x.av_dr_cr AS dr_cr,
             x.av_amount AS amount, x.av_signed_amount AS signed
        FROM (${(0, voucher_books_sql_1.countedLegsSql)(s, { from: s.from, upTo: s.to, ledgers: null })}) x),
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
function draftsSql(s) {
    return client_1.Prisma.sql `
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
function leglessSql(s) {
    return client_1.Prisma.sql `
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
exports.GAP_SPAN_CAP = 100_000;
function numberGapsSql(s) {
    return client_1.Prisma.sql `
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
      HAVING MAX(h.avh_voucher_no) - MIN(h.avh_voucher_no) <= ${exports.GAP_SPAN_CAP}),
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
//# sourceMappingURL=day-summary.sql.js.map