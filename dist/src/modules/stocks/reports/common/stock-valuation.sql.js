"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poolValuationCtes = poolValuationCtes;
exports.itemValuationSql = itemValuationSql;
exports.valueInScope = valueInScope;
const client_1 = require("@prisma/client");
const stock_voucher_posting_helper_1 = require("../../stock-voucher/stock-voucher-posting.helper");
const IDENT = /^[a-z][a-z0-9_]*$/;
function ident(name) {
    if (!IDENT.test(name))
        throw new Error(`stock valuation: bad CTE name ${name}`);
    return client_1.Prisma.raw(name);
}
function poolValuationCtes(o) {
    const h = ident(o.holdings);
    const pol = ident(`${o.prefix}_pol`);
    const rv = ident(`${o.prefix}_rv`);
    const hp = ident(`${o.prefix}_hp`);
    const pool = ident(`${o.prefix}_pool`);
    const rate = ident(`${o.prefix}_rate`);
    const val = ident(`${o.prefix}_val`);
    const scrValue = client_1.Prisma.raw(o.wot ? 'r.scr_value_wot' : 'r.scr_value');
    const lastRate = client_1.Prisma.raw(o.wot ? 'x.sml_cost_rate_wot' : 'x.sml_cost_rate');
    return client_1.Prisma.sql `
    ${pol} AS MATERIALIZED (
      SELECT k.branch, k.item, COALESCE(stp.stp_valuation_method, 'WAVG')::text AS vm
        FROM (SELECT DISTINCT branch, item FROM ${h}) k
        JOIN inventory.item_master itm ON itm.item_id = k.item
        ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
        companyId: client_1.Prisma.sql `${o.companyId}::uuid`,
        branchId: client_1.Prisma.raw('k.branch'),
        itemId: client_1.Prisma.raw('k.item'),
        itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
        onDate: client_1.Prisma.sql `${o.asOf}::date`,
    })}),
    ${rv} AS MATERIALIZED (
      SELECT r.scr_branch_id AS branch, r.scr_item_id AS item,
             CASE WHEN p.vm = 'LOT_ACTUAL' THEN r.scr_lot_id END AS pool_lot,
             SUM(${scrValue}) AS v
        FROM stock.stock_cost_revaluation r
        JOIN ${pol} p ON p.branch = r.scr_branch_id AND p.item = r.scr_item_id
       WHERE r.scr_company_id = ${o.companyId}::uuid
         AND r.scr_is_deleted = false
         AND r.scr_doc_date <= ${o.asOf}::date
       GROUP BY 1, 2, 3),
    ${hp} AS MATERIALIZED (
      SELECT x.branch, x.item, x.lot, x.godown, x.bucket, x.q, x.v, p.vm,
             CASE WHEN p.vm = 'LOT_ACTUAL' THEN x.lot END AS pool_lot
        FROM ${h} x
        JOIN ${pol} p ON p.branch = x.branch AND p.item = x.item),
    ${pool} AS MATERIALIZED (
      SELECT branch, item, pool_lot,
             SUM(q) AS pq, bool_or(q <> 0) AS has_stock, SUM(v) AS hv
        FROM ${hp}
       GROUP BY 1, 2, 3),
    ${rate} AS MATERIALIZED (
      SELECT pl.branch, pl.item, pl.pool_lot,
             CASE WHEN pl.pq > 0 THEN ROUND((pl.hv + COALESCE(r.v, 0)) / pl.pq, 6)
                  WHEN NOT pl.has_stock THEN 0::numeric
                  ELSE COALESCE((
                    SELECT ${lastRate}
                      FROM stock.stock_ledger x
                     WHERE x.sml_company_id = ${o.companyId}::uuid
                       AND x.sml_branch_id = pl.branch
                       AND x.sml_item_id = pl.item
                       AND (pl.pool_lot IS NULL OR x.sml_lot_id = pl.pool_lot)
                       AND x.sml_is_deleted = false
                       AND x.sml_is_reversal = false
                       AND x.sml_doc_date <= ${o.asOf}::date
                       AND NOT EXISTS (
                         SELECT 1 FROM stock.stock_ledger y
                          WHERE y.sml_reverses_id = x.sml_id AND y.sml_acc_year = x.sml_acc_year
                            AND y.sml_is_reversal = true AND y.sml_is_deleted = false)
                     ORDER BY x.sml_doc_datetime DESC, x.sml_id DESC
                     LIMIT 1), 0::numeric)
             END AS r
        FROM ${pool} pl
        LEFT JOIN ${rv} r
          ON r.branch = pl.branch AND r.item = pl.item
         AND r.pool_lot IS NOT DISTINCT FROM pl.pool_lot),
    ${val} AS MATERIALIZED (
      SELECT x.branch, x.item, x.lot, x.godown, x.bucket, x.q, x.v, x.vm,
             t.r AS rate, ROUND(x.q * t.r, 2) AS value
        FROM ${hp} x
        JOIN ${rate} t
          ON t.branch = x.branch AND t.item = x.item
         AND t.pool_lot IS NOT DISTINCT FROM x.pool_lot)`;
}
function itemValuationSql(s) {
    const v = client_1.Prisma.raw(s.wot ? 'l.sml_cost_value_wot' : 'l.sml_cost_value');
    return client_1.Prisma.sql `
    WITH ih AS (
      SELECT l.sml_branch_id AS branch, l.sml_item_id AS item, l.sml_lot_id AS lot,
             l.sml_godown_id AS godown, l.sml_bucket::text AS bucket,
             SUM(l.sml_signed_base_qty) AS q, SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_branch_id = ${s.branchId}::uuid
         AND l.sml_item_id = ${s.itemId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date <= ${s.asOf}::date
       GROUP BY 1, 2, 3, 4, 5),
    ${poolValuationCtes({
        holdings: 'ih',
        prefix: 'iv',
        companyId: s.companyId,
        asOf: s.asOf,
        wot: s.wot,
    })}
    SELECT lot, godown, bucket, q, vm, rate, value FROM iv_val`;
}
function valueInScope(rows, scope) {
    let qty = new client_1.Prisma.Decimal(0);
    let value = new client_1.Prisma.Decimal(0);
    for (const r of rows) {
        if (scope.godownId && r.godown !== scope.godownId)
            continue;
        if (scope.bucket && r.bucket !== scope.bucket)
            continue;
        if (scope.lotId && r.lot !== scope.lotId)
            continue;
        qty = qty.plus(r.q);
        value = value.plus(r.value);
    }
    return { qty, value };
}
//# sourceMappingURL=stock-valuation.sql.js.map