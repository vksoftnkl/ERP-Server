"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUNDRY_CREDITORS_GROUP_ID = exports.SUNDRY_DEBTORS_GROUP_ID = void 0;
exports.bucketColumns = bucketColumns;
exports.hasDueFilter = hasDueFilter;
exports.billsWith = billsWith;
exports.partiesWith = partiesWith;
exports.partyTotalsCte = partyTotalsCte;
exports.branchSummarySql = branchSummarySql;
exports.ledgerClosingSql = ledgerClosingSql;
const client_1 = require("@prisma/client");
const party_outstanding_ageing_1 = require("./party-outstanding.ageing");
exports.SUNDRY_DEBTORS_GROUP_ID = '019eee86-f34b-7ddc-91e2-efca49e5e8e8';
exports.SUNDRY_CREDITORS_GROUP_ID = '019eee86-f34b-7d73-8a79-f5c6f036439a';
function bucketColumns(scope) {
    return Array.from({ length: (0, party_outstanding_ageing_1.bucketCount)(scope.edges, scope.ageBy) }, (_, i) => `b${i}`);
}
function hasDueFilter(scope) {
    return scope.onlyOverdue || scope.minDueDays !== null || scope.maxDueDays !== null;
}
function grpCte(s) {
    return client_1.Prisma.sql `
    grp(id) AS (
      SELECT ${s.group?.groupId ?? null}::uuid
      UNION
      SELECT g.acc_group_id
        FROM accounts.acc_group_master g
        JOIN grp ON g.acc_group_parent_id = grp.id
       WHERE g.acc_group_is_deleted = false)`;
}
function ptyCte(s) {
    const receivable = s.side === 'RECEIVABLE';
    const phone = receivable
        ? client_1.Prisma.sql `COALESCE(NULLIF(btrim(c.cus_phone1), ''), NULLIF(btrim(c.cus_phone2), ''),
                          NULLIF(btrim(l.led_phone1), ''))`
        : client_1.Prisma.sql `COALESCE(NULLIF(btrim(sp.sup_phone), ''), NULLIF(btrim(l.led_phone1), ''))`;
    const roleRow = receivable
        ? client_1.Prisma.sql `(c.cus_id IS NOT NULL AND c.cus_is_deleted = false
                  AND (c.cus_company_id IS NULL OR c.cus_company_id = ${s.companyId}::uuid))`
        : client_1.Prisma.sql `(sp.sup_id IS NOT NULL AND sp.sup_is_deleted = false
                  AND (sp.sup_company_id IS NULL OR sp.sup_company_id = ${s.companyId}::uuid))`;
    const groupClause = s.group
        ? s.group.rootRole
            ? client_1.Prisma.sql `(l.led_group_id IN (SELECT id FROM grp) OR ${roleRow})`
            : client_1.Prisma.sql `l.led_group_id IN (SELECT id FROM grp)`
        : client_1.Prisma.sql `true`;
    return client_1.Prisma.sql `
    pty AS (
      SELECT l.led_id AS party_id, l.led_name AS name, l.led_group_id AS group_id,
             l.led_is_deleted AS deleted,
             ${receivable ? client_1.Prisma.sql `c.cus_area_id` : client_1.Prisma.sql `NULL::uuid`} AS area_id,
             ${receivable ? client_1.Prisma.sql `am.arm_name` : client_1.Prisma.sql `NULL::text`} AS area_name,
             ${receivable ? client_1.Prisma.sql `c.cus_default_salesman` : client_1.Prisma.sql `NULL::uuid`} AS salesman_id,
             ${phone} AS phone,
             ${receivable ? client_1.Prisma.sql `c.cus_credit_days` : client_1.Prisma.sql `sp.sup_credit_days`} AS credit_days,
             ${receivable
        ? client_1.Prisma.sql `CASE WHEN c.cus_credit_amt_limit > 0 THEN c.cus_credit_amt_limit END`
        : client_1.Prisma.sql `NULL::numeric`} AS credit_limit
        FROM accounts.acc_ledger_master l
        LEFT JOIN sales.customers c ON c.cus_id = l.led_id
        LEFT JOIN purchase.suppliers sp ON sp.sup_id = l.led_id
        LEFT JOIN sales.area_master am ON am.arm_id = c.cus_area_id
       WHERE (l.led_company_id IS NULL OR l.led_company_id = ${s.companyId}::uuid)
         AND ${groupClause}
         AND (${s.partyId}::uuid IS NULL OR l.led_id = ${s.partyId}::uuid)
         AND (${s.areaId}::uuid IS NULL OR c.cus_area_id = ${s.areaId}::uuid)
         AND (${s.salesmanId}::uuid IS NULL OR c.cus_default_salesman = ${s.salesmanId}::uuid)
         AND (${s.collectionDay}::int IS NULL
              OR am.arm_collection_days @> ARRAY[${s.collectionDay}::int]))`;
}
function candCte(s) {
    return client_1.Prisma.sql `
    cand AS (
      SELECT b.abl_id, b.abl_acc_year, b.abl_party_id AS party_id, b.abl_branch_id,
             b.abl_bill_type, b.abl_src_doc_type, b.abl_src_doc_id, b.abl_src_acc_year,
             b.abl_voucher_id, COALESCE(b.abl_doc_refno, b.abl_voucher_refno) AS doc_refno,
             b.abl_doc_date, b.abl_due_date, b.abl_credit_days, b.abl_grace_days,
             btrim(b.abl_dr_cr) AS dr_cr, b.abl_bill_amount AS bill_amount,
             b.abl_alloc_amount + b.abl_disc_amount + b.abl_writeoff_amount AS cached
        FROM accounts.acc_bill_balance b
       WHERE b.abl_company_id = ${s.companyId}::uuid
         AND b.abl_is_deleted = false
         AND b.abl_doc_date <= ${s.asOn}::date
         AND b.abl_acc_year <= ${s.fyName}::char(9)
         AND (${s.branchId}::uuid IS NULL OR b.abl_branch_id = ${s.branchId}::uuid)
         AND b.abl_party_id IN (SELECT party_id FROM pty)
         AND (b.abl_pending_amount <> 0
              OR EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment a
                          WHERE a.abj_bill_id = b.abl_id
                            AND a.abj_bill_acc_year = b.abl_acc_year
                            AND a.abj_is_deleted = false
                            AND a.abj_adj_date > ${s.asOn}::date))
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_balance ch
                          WHERE ch.abl_parent_bill_id = b.abl_id
                            AND ch.abl_parent_acc_year = b.abl_acc_year
                            AND ch.abl_bill_type = 'OPENING'
                            AND ch.abl_is_deleted = false
                            AND ch.abl_acc_year <= ${s.fyName}::char(9)))`;
}
function sumsCte(s) {
    return client_1.Prisma.sql `
    sums AS (
      SELECT c.abl_id, c.abl_acc_year,
             COALESCE(SUM(a.abj_amount) FILTER (WHERE a.abj_adj_date <= ${s.asOn}::date), 0) AS set_d,
             COALESCE(SUM(a.abj_amount)
                        FILTER (WHERE NOT (COALESCE(a.abj_is_post_dated, false)
                                           AND a.abj_adj_date > ${s.today}::date)), 0) AS set_cache
        FROM cand c
        LEFT JOIN accounts.acc_bill_adjustment a
          ON a.abj_bill_id = c.abl_id AND a.abj_bill_acc_year = c.abl_acc_year
         AND a.abj_is_deleted = false
       GROUP BY c.abl_id, c.abl_acc_year)`;
}
function billCte(s) {
    return client_1.Prisma.sql `
    bill AS (
      SELECT c.*,
             c.cached - s.set_cache AS gap,
             GREATEST(c.cached - s.set_cache, 0) AS tendered,
             c.bill_amount - s.set_d - GREATEST(c.cached - s.set_cache, 0) AS pending,
             (c.dr_cr = ${s.owedSide}) AS is_owed,
             COALESCE(c.abl_due_date, c.abl_doc_date + COALESCE(c.abl_credit_days, 0)::int) AS due_eff
        FROM cand c
        JOIN sums s ON s.abl_id = c.abl_id AND s.abl_acc_year = c.abl_acc_year)`;
}
function obCte(s) {
    const age = s.ageBy === 'DUE_DATE'
        ? client_1.Prisma.sql `(${s.asOn}::date - b.due_eff)`
        : client_1.Prisma.sql `(${s.asOn}::date - b.abl_doc_date)`;
    return client_1.Prisma.sql `
    ob AS (
      SELECT b.*,
             (${s.asOn}::date - b.abl_doc_date) AS age_days,
             ${age} AS age,
             CASE WHEN b.is_owed
                  THEN GREATEST(${s.asOn}::date - b.due_eff - COALESCE(b.abl_grace_days, 0)::int, 0)
                  ELSE 0 END AS overdue_days,
             CASE WHEN b.is_owed THEN ${(0, party_outstanding_ageing_1.bucketIndexSql)(age, s.edges, s.ageBy)} END AS bkt,
             CASE WHEN b.is_owed THEN b.pending ELSE -b.pending END AS signed
        FROM bill b
       WHERE b.pending <> 0
         AND (${s.includeOnAccount}::boolean OR b.is_owed))`;
}
function dueWindow(s, x) {
    const r = client_1.Prisma.raw(x);
    return client_1.Prisma.sql `(${r}.is_owed
      AND (NOT ${s.onlyOverdue}::boolean OR ${r}.overdue_days > 0)
      AND (${s.minDueDays}::int IS NULL OR ${r}.overdue_days >= ${s.minDueDays}::int)
      AND (${s.maxDueDays}::int IS NULL OR ${r}.overdue_days <= ${s.maxDueDays}::int))`;
}
function oCte(s, billLevel) {
    const filter = billLevel && hasDueFilter(s) ? dueWindow(s, 'ob') : client_1.Prisma.sql `true`;
    return client_1.Prisma.sql `o AS (SELECT ob.* FROM ob WHERE ${filter})`;
}
function billsWith(s, billLevel) {
    return client_1.Prisma.sql `WITH RECURSIVE ${grpCte(s)}, ${ptyCte(s)}, ${candCte(s)}, ${sumsCte(s)},
    ${billCte(s)}, ${obCte(s)}, ${oCte(s, billLevel)}`;
}
function pdcCte(s) {
    return client_1.Prisma.sql `
    pdc AS (
      SELECT r.apd_party_id AS party_id, r.apd_branch_id AS branch_id,
             SUM(r.apd_amount) AS amt, COUNT(*) AS n
        FROM accounts.acc_pdc_register r
       WHERE r.apd_company_id = ${s.companyId}::uuid
         AND r.apd_is_deleted = false
         AND r.apd_tra_type = ${s.traType}
         AND r.apd_status IN ('HELD', 'DEPOSITED')
         AND r.apd_instrument_date > ${s.asOn}::date
         AND r.apd_received_on <= ${s.asOn}::date
         AND (${s.branchId}::uuid IS NULL OR r.apd_branch_id = ${s.branchId}::uuid)
         AND r.apd_party_id IN (SELECT party_id FROM pty)
       GROUP BY r.apd_party_id, r.apd_branch_id)`;
}
function bncCte(s) {
    return client_1.Prisma.sql `
    bnc AS (
      SELECT DISTINCT r.apd_party_id AS party_id
        FROM accounts.acc_pdc_register r
       WHERE r.apd_company_id = ${s.companyId}::uuid
         AND r.apd_is_deleted = false
         AND r.apd_tra_type = ${s.traType}
         AND r.apd_status = 'BOUNCED'
         AND r.apd_bounce_date <= ${s.asOn}::date
         AND (${s.branchId}::uuid IS NULL OR r.apd_branch_id = ${s.branchId}::uuid)
         AND r.apd_party_id IN (SELECT party_id FROM pty))`;
}
function paCte(s) {
    const buckets = bucketColumns(s).map((col, i) => client_1.Prisma.sql `COALESCE(SUM(o.pending) FILTER (WHERE o.bkt = ${i}::int), 0) AS ${client_1.Prisma.raw(col)}`);
    return client_1.Prisma.sql `
    pa AS (
      SELECT o.party_id,
             COUNT(*) FILTER (WHERE o.is_owed) AS bills,
             COALESCE(SUM(o.pending) FILTER (WHERE o.is_owed), 0) AS owed,
             COALESCE(SUM(o.pending) FILTER (WHERE NOT o.is_owed), 0) AS on_account,
             ${client_1.Prisma.join(buckets, ', ')},
             COALESCE(SUM(o.pending) FILTER (WHERE o.is_owed AND o.overdue_days > 0), 0) AS overdue,
             MAX(o.age) FILTER (WHERE o.is_owed) AS oldest,
             COALESCE(SUM(o.pending)
                        FILTER (WHERE o.is_owed AND o.age > ${(0, party_outstanding_ageing_1.aboveDaysEdge)(s.edges)}::int), 0) AS above_amt,
             COALESCE(SUM(o.pending)
                        FILTER (WHERE o.is_owed AND o.due_eff > ${s.asOn}::date
                                  AND o.due_eff <= ${s.asOn}::date + 7), 0) AS due_next,
             bool_or(${dueWindow(s, 'o')}) AS due_match
        FROM o
       GROUP BY o.party_id)`;
}
function pfCte(s) {
    const buckets = bucketColumns(s).map((col) => client_1.Prisma.sql `COALESCE(a.${client_1.Prisma.raw(col)}, 0) AS ${client_1.Prisma.raw(col)}`);
    return client_1.Prisma.sql `
    pdcp AS (SELECT party_id, SUM(amt) AS amt, SUM(n) AS n FROM pdc GROUP BY party_id),
    pf AS (
      SELECT p.party_id, p.name, p.group_id, p.area_id, p.area_name, p.salesman_id, p.phone,
             p.credit_days, p.credit_limit,
             COALESCE(a.bills, 0) AS bills,
             COALESCE(a.owed, 0) AS owed,
             COALESCE(a.on_account, 0) AS on_account,
             ${client_1.Prisma.join(buckets, ', ')},
             COALESCE(a.overdue, 0) AS overdue,
             a.oldest,
             COALESCE(a.above_amt, 0) AS above_amt,
             COALESCE(a.due_next, 0) AS due_next,
             COALESCE(d.amt, 0) AS pdc_amt,
             COALESCE(d.n, 0) AS pdc_n,
             COALESCE(a.owed, 0) - COALESCE(a.on_account, 0)
               - CASE WHEN ${s.deductPdc}::boolean THEN COALESCE(d.amt, 0) ELSE 0 END AS net,
             (bn.party_id IS NOT NULL) AS bounced
        FROM pty p
        LEFT JOIN pa a ON a.party_id = p.party_id
        LEFT JOIN pdcp d ON d.party_id = p.party_id
        LEFT JOIN bnc bn ON bn.party_id = p.party_id
       WHERE (a.party_id IS NOT NULL OR (NOT ${s.hideZero}::boolean AND p.deleted = false))
         AND (NOT ${s.hideZero}::boolean OR COALESCE(a.owed, 0) <> 0 OR COALESCE(a.on_account, 0) <> 0)
         AND (NOT ${hasDueFilter(s)}::boolean OR COALESCE(a.due_match, false)))`;
}
function partiesWith(s) {
    return client_1.Prisma.sql `${billsWith(s, false)}, ${pdcCte(s)}, ${bncCte(s)}, ${paCte(s)}, ${pfCte(s)}`;
}
function partyTotalsCte(s) {
    const buckets = bucketColumns(s).map((col) => client_1.Prisma.sql `COALESCE(SUM(${client_1.Prisma.raw(col)}), 0) AS ${client_1.Prisma.raw(`t_${col}`)}`);
    return client_1.Prisma.sql `
    tot AS (
      SELECT COUNT(*) AS t_parties,
             COALESCE(SUM(bills), 0) AS t_bills,
             COALESCE(SUM(owed), 0) AS t_owed,
             COALESCE(SUM(on_account), 0) AS t_on_account,
             COALESCE(SUM(net), 0) AS t_net,
             ${client_1.Prisma.join(buckets, ', ')},
             COALESCE(SUM(overdue), 0) AS t_overdue,
             COALESCE(SUM(pdc_amt), 0) AS t_pdc_amt,
             COALESCE(SUM(pdc_n), 0) AS t_pdc_n,
             COALESCE(SUM(above_amt), 0) AS t_above_amt,
             COUNT(*) FILTER (WHERE above_amt > 0) AS t_above_parties,
             COALESCE(SUM(due_next), 0) AS t_due_next
        FROM pf)`;
}
function branchSummarySql(s) {
    const buckets = bucketColumns(s).map((col, i) => client_1.Prisma.sql `COALESCE(SUM(o.pending) FILTER (WHERE o.bkt = ${i}::int), 0) AS ${client_1.Prisma.raw(col)}`);
    const zero = bucketColumns(s).map((col) => client_1.Prisma.sql `COALESCE(sb.${client_1.Prisma.raw(col)}, 0) AS ${client_1.Prisma.raw(col)}`);
    return client_1.Prisma.sql `
    ${partiesWith(s)},
    sb AS (
      SELECT o.abl_branch_id AS key,
             COUNT(DISTINCT o.party_id) AS parties,
             COALESCE(SUM(o.pending) FILTER (WHERE o.is_owed), 0) AS owed,
             COALESCE(SUM(o.pending) FILTER (WHERE NOT o.is_owed), 0) AS on_account,
             COALESCE(SUM(o.signed), 0) AS signed,
             ${client_1.Prisma.join(buckets, ', ')},
             COALESCE(SUM(o.pending) FILTER (WHERE o.is_owed AND o.overdue_days > 0), 0) AS overdue
        FROM o
       WHERE o.party_id IN (SELECT party_id FROM pf)
       GROUP BY o.abl_branch_id),
    spdc AS (
      SELECT branch_id AS key, SUM(amt) AS amt
        FROM pdc
       WHERE ${s.deductPdc}::boolean AND party_id IN (SELECT party_id FROM pf)
       GROUP BY branch_id)
    SELECT COALESCE(sb.key, spdc.key) AS key, br.br_name AS name,
           COALESCE(sb.parties, 0) AS parties,
           COALESCE(sb.owed, 0) AS owed,
           COALESCE(sb.on_account, 0) AS on_account,
           COALESCE(sb.signed, 0) - COALESCE(spdc.amt, 0) AS net,
           ${client_1.Prisma.join(zero, ', ')},
           COALESCE(sb.overdue, 0) AS overdue
      FROM sb
      FULL JOIN spdc ON spdc.key = sb.key
      LEFT JOIN public.branch_master br ON br.br_id = COALESCE(sb.key, spdc.key)
     ORDER BY br.br_name NULLS LAST, 1`;
}
function ledgerClosingSql(s, ledgerId) {
    return client_1.Prisma.sql `
    SELECT (SELECT COALESCE(SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END), 0)
              FROM accounts.acc_opening_balance o
             WHERE o.op_company_id = ${s.companyId}::uuid
               AND o.op_ledger_id  = ${ledgerId}::uuid
               AND o.op_acc_year   = ${s.fyName}::char(9)
               AND o.op_is_deleted = false
               AND (${s.branchId}::uuid IS NULL OR o.op_branch_id = ${s.branchId}::uuid))
         + (SELECT COALESCE(SUM(v.av_signed_amount), 0)
              FROM accounts.acc_vouchers v
              JOIN accounts.acc_voucher_header h
                ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
             WHERE v.av_company_id = ${s.companyId}::uuid
               AND v.av_ledger_id  = ${ledgerId}::uuid
               AND v.av_acc_year   = ${s.fyName}::char(9)
               AND v.av_voucher_date <= ${s.asOn}::date
               AND v.av_is_deleted = false
               AND h.avh_is_deleted = false
               AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
               AND (${s.branchId}::uuid IS NULL OR v.av_branch_id = ${s.branchId}::uuid)) AS bal`;
}
//# sourceMappingURL=party-outstanding.sql.js.map