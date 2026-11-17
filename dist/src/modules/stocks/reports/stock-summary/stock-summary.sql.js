"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasItemFilter = hasItemFilter;
exports.passSql = passSql;
exports.factsSql = factsSql;
exports.lastSaleSql = lastSaleSql;
exports.balanceNowSql = balanceNowSql;
exports.rowsAfterSql = rowsAfterSql;
exports.transitNowSql = transitNowSql;
exports.transitReplaySql = transitReplaySql;
exports.branchesNowSql = branchesNowSql;
exports.branchesReplaySql = branchesReplaySql;
exports.companyBranchesSql = companyBranchesSql;
exports.lotsNowSql = lotsNowSql;
exports.lotNamesSql = lotNamesSql;
exports.lastPurchaseSql = lastPurchaseSql;
exports.bndNowSql = bndNowSql;
const client_1 = require("@prisma/client");
const item_ledger_sql_1 = require("../item-ledger/item-ledger.sql");
const stock_valuation_sql_1 = require("../common/stock-valuation.sql");
const delivery_pending_sql_1 = require("../../../sales/delivery/core/delivery-pending.sql");
const MOVE_TXNS = client_1.Prisma.sql `('TRANSFER_OUT','TRANSFER_IN','BUCKET_OUT','BUCKET_IN')`;
function hasItemFilter(s) {
    return !!s.groupId || !!s.brandId;
}
function itemFilterCtes(s) {
    const parts = [];
    if (s.groupId) {
        parts.push(client_1.Prisma.sql `
    gt AS (
      SELECT g.itg_id AS id FROM inventory.item_group_master g WHERE g.itg_id = ${s.groupId}::uuid
      UNION
      SELECT c.itg_id FROM inventory.item_group_master c JOIN gt ON c.itg_parent_id = gt.id)`);
    }
    if (s.brandId) {
        parts.push(client_1.Prisma.sql `
    bt AS (
      SELECT b.brand_id AS id FROM inventory.item_brand_master b WHERE b.brand_id = ${s.brandId}::uuid
      UNION
      SELECT c.brand_id FROM inventory.item_brand_master c JOIN bt ON c.brand_parent_id = bt.id)`);
    }
    parts.push(client_1.Prisma.sql `
    it AS (
      SELECT i.item_id FROM inventory.item_master i
       WHERE true
         ${s.groupId ? client_1.Prisma.sql `AND i.item_group_id IN (SELECT id FROM gt)` : client_1.Prisma.empty}
         ${s.brandId ? client_1.Prisma.sql `AND i.item_brand_id IN (SELECT id FROM bt)` : client_1.Prisma.empty})`);
    return client_1.Prisma.join(parts, ',');
}
function withItems(s) {
    return hasItemFilter(s) ? client_1.Prisma.sql `WITH RECURSIVE ${itemFilterCtes(s)},` : client_1.Prisma.sql `WITH`;
}
function itemIn(col, s) {
    return hasItemFilter(s)
        ? client_1.Prisma.sql `AND ${client_1.Prisma.raw(col)} IN (SELECT item_id FROM it)`
        : client_1.Prisma.empty;
}
function inScope(alias, s) {
    const a = client_1.Prisma.raw(alias);
    if (!s.godownId && !s.bucket)
        return client_1.Prisma.sql `true`;
    return client_1.Prisma.sql `(true
      ${s.godownId ? client_1.Prisma.sql `AND ${a}.sml_godown_id = ${s.godownId}::uuid` : client_1.Prisma.empty}
      ${s.bucket ? client_1.Prisma.sql `AND ${a}.sml_bucket = ${s.bucket}` : client_1.Prisma.empty})`;
}
function passSql(s) {
    const v = (0, item_ledger_sql_1.costValueCol)('l', s.wot);
    return client_1.Prisma.sql `
    ${withItems(s)}
    op AS (
      SELECT l.sml_item_id AS item, l.sml_lot_id AS lot, l.sml_godown_id AS godown,
             l.sml_bucket::text AS bucket,
             SUM(l.sml_signed_base_qty) AS q, SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_branch_id = ${s.branchId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date < ${s.from}::date
         ${itemIn('l.sml_item_id', s)}
       GROUP BY 1, 2, 3, 4),
    pr AS (
      SELECT l.sml_item_id AS item, l.sml_lot_id AS lot, l.sml_godown_id AS godown,
             l.sml_bucket::text AS bucket,
             l.sml_signed_base_qty AS sq, l.sml_direction * ${v} AS sv,
             (CASE WHEN l.sml_is_reversal THEN -l.sml_direction ELSE l.sml_direction END)::int AS nat,
             l.sml_txn_type::text AS txn, l.sml_src_doc_id AS doc_id,
             COALESCE(l.sml_src_acc_year, l.sml_acc_year) AS src_year,
             l.sml_line_no AS line_no, l.sml_split_no AS split_no, l.sml_is_reversal AS is_rev,
             ${inScope('l', s)} AS ins
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_branch_id = ${s.branchId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date BETWEEN ${s.from}::date AND ${s.to}::date
         ${itemIn('l.sml_item_id', s)}),
    mv AS (
      SELECT item, doc_id, src_year, line_no, split_no, lot, is_rev
        FROM pr
       WHERE ins AND txn IN ${MOVE_TXNS}
       GROUP BY 1, 2, 3, 4, 5, 6, 7
      HAVING COUNT(DISTINCT nat) = 2),
    prc AS (
      SELECT pr.*, (mv.doc_id IS NOT NULL) AS internal
        FROM pr
        LEFT JOIN mv
          ON pr.ins AND pr.txn IN ${MOVE_TXNS}
         AND mv.item = pr.item AND mv.doc_id = pr.doc_id AND mv.src_year = pr.src_year
         AND mv.line_no = pr.line_no AND mv.split_no = pr.split_no
         AND mv.lot = pr.lot AND mv.is_rev = pr.is_rev),
    h AS (
      SELECT item, lot, godown, bucket,
             COALESCE(SUM(oq), 0) AS oq, COALESCE(SUM(ov), 0) AS ov,
             COALESCE(SUM(sq), 0) AS pq, COALESCE(SUM(sv), 0) AS pv,
             COALESCE(SUM(sq) FILTER (WHERE nat = 1 AND NOT internal), 0) AS iq,
             COALESCE(-SUM(sq) FILTER (WHERE nat = -1 AND NOT internal), 0) AS xq,
             COALESCE(SUM(sv) FILTER (WHERE nat = 1 AND NOT internal), 0) AS iv,
             COALESCE(-SUM(sv) FILTER (WHERE nat = -1 AND NOT internal), 0) AS xv,
             COUNT(sq)::int AS n
        FROM (SELECT item, lot, godown, bucket, q AS oq, v AS ov,
                     NULL::numeric AS sq, NULL::numeric AS sv, NULL::int AS nat, false AS internal
                FROM op
              UNION ALL
              SELECT item, lot, godown, bucket, NULL, NULL, sq, sv, nat, internal FROM prc) u
       GROUP BY 1, 2, 3, 4),
    ho AS (
      SELECT ${s.branchId}::uuid AS branch, item, lot, godown, bucket, oq AS q, ov AS v FROM h),
    hc AS (
      SELECT ${s.branchId}::uuid AS branch, item, lot, godown, bucket, oq + pq AS q, ov + pv AS v FROM h),
    ${(0, stock_valuation_sql_1.poolValuationCtes)({ holdings: 'ho', prefix: 'vo', companyId: s.companyId, asOf: s.openingAsOf, wot: s.wot })},
    ${(0, stock_valuation_sql_1.poolValuationCtes)({ holdings: 'hc', prefix: 'vc', companyId: s.companyId, asOf: s.to, wot: s.wot })}
    SELECT 'H'::text AS part, h.item, h.lot, h.godown, h.bucket,
           h.oq, h.pq, h.iq, h.xq, h.iv, h.xv, h.n, NULL::numeric AS value, NULL::text AS vm
      FROM h
    UNION ALL
    SELECT 'O', item, lot, godown, bucket, NULL, NULL, NULL, NULL, NULL, NULL, NULL, value, vm FROM vo_val
    UNION ALL
    SELECT 'C', item, lot, godown, bucket, NULL, NULL, NULL, NULL, NULL, NULL, NULL, value, vm FROM vc_val`;
}
function factsSql(itemIds) {
    return client_1.Prisma.sql `
    SELECT i.item_id, NULLIF(btrim(i.item_code), '') AS code, i.item_name_en AS name,
           NULLIF(btrim(i.item_default_barcode), '') AS barcode, NULLIF(btrim(i.item_sku), '') AS sku,
           i.item_group_id AS group_id, g.itg_name AS group_name,
           i.item_brand_id AS brand_id, br.brand_name,
           i.item_section_id AS section_id, sc.sec_name AS section_name,
           i.item_category_id AS category_id, ct.category_name,
           i.item_company_id AS company_id, i.item_intimate_before_days AS warn_days,
           COALESCE(NULLIF(btrim(bm.unit_alias), ''), bm.unit_name) AS base_unit,
           du.iuc_id AS default_iuc_id, du.iuc_to_base_factor AS default_factor,
           COALESCE(du.iuc_is_base_unit, false) AS default_is_base,
           COALESCE(NULLIF(btrim(dm.unit_alias), ''), dm.unit_name) AS default_unit
      FROM inventory.item_master i
      LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
      LEFT JOIN inventory.item_brand_master br ON br.brand_id = i.item_brand_id
      LEFT JOIN inventory.item_section_master sc ON sc.sec_id = i.item_section_id
      LEFT JOIN inventory.item_category_master ct ON ct.category_id = i.item_category_id
      LEFT JOIN LATERAL (
        SELECT x.iuc_unit_id
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = i.item_id AND x.iuc_is_base_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno NULLS LAST, x.iuc_id
         LIMIT 1) bu ON true
      LEFT JOIN inventory.item_unit_master bm ON bm.unit_id = COALESCE(bu.iuc_unit_id, i.item_base_unit_id)
      LEFT JOIN LATERAL (
        SELECT x.iuc_id, x.iuc_unit_id, x.iuc_to_base_factor, x.iuc_is_base_unit
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = i.item_id AND x.iuc_is_default_unit = true AND x.iuc_is_deleted = false
           AND x.iuc_to_base_factor > 0
         ORDER BY x.iuc_unit_slno NULLS LAST, x.iuc_id
         LIMIT 1) du ON true
      LEFT JOIN inventory.item_unit_master dm ON dm.unit_id = du.iuc_unit_id
     WHERE i.item_id = ANY(${itemIds}::uuid[])`;
}
function lastSaleSql(s, itemIds) {
    return client_1.Prisma.sql `
    SELECT k.item, ls.d::text AS last_sale
      FROM unnest(${itemIds}::uuid[]) AS k(item)
      LEFT JOIN LATERAL (
        SELECT x.sml_doc_date AS d
          FROM stock.stock_ledger x
         WHERE x.sml_company_id = ${s.companyId}::uuid
           AND x.sml_branch_id = ${s.branchId}::uuid
           AND x.sml_item_id = k.item
           AND x.sml_src_module = 'SALES'
           AND x.sml_is_deleted = false
           AND x.sml_txn_type = 'SALE'
           AND x.sml_is_reversal = false
           AND x.sml_doc_date <= ${s.to}::date
           AND NOT EXISTS (
             SELECT 1 FROM stock.stock_ledger y
              WHERE y.sml_reverses_id = x.sml_id AND y.sml_acc_year = x.sml_acc_year
                AND y.sml_is_reversal = true AND y.sml_is_deleted = false)
         ORDER BY x.sml_doc_date DESC
         LIMIT 1) ls ON true`;
}
function balanceNowSql(s) {
    return client_1.Prisma.sql `
    ${hasItemFilter(s) ? client_1.Prisma.sql `WITH RECURSIVE ${itemFilterCtes(s)}` : client_1.Prisma.empty}
    SELECT b.sbl_item_id AS item, b.sbl_lot_id AS lot, b.sbl_godown_id AS godown,
           b.sbl_bucket::text AS bucket,
           b.sbl_on_hand_qty AS on_hand, b.sbl_reserved_qty AS reserved,
           b.sbl_available_qty AS available, b.sbl_transit_in_qty AS transit_in,
           ${client_1.Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value')} AS value,
           ${client_1.Prisma.raw(s.wot ? 'b.sbl_avg_cost_rate_wot' : 'b.sbl_avg_cost_rate')} AS rate,
           COALESCE(lt.slt_expiry_date, b.sbl_expiry_date)::text AS expiry
      FROM stock.stock_balance b
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = b.sbl_lot_id
     WHERE b.sbl_company_id = ${s.companyId}::uuid
       AND b.sbl_branch_id = ${s.branchId}::uuid
       AND b.sbl_is_deleted = false
       AND (b.sbl_on_hand_qty <> 0 OR b.sbl_reserved_qty <> 0 OR b.sbl_transit_in_qty <> 0
            OR ${client_1.Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value')} <> 0)
       ${itemIn('b.sbl_item_id', s)}`;
}
function rowsAfterSql(s) {
    return client_1.Prisma.sql `
    ${hasItemFilter(s) ? client_1.Prisma.sql `WITH RECURSIVE ${itemFilterCtes(s)}` : client_1.Prisma.empty}
    SELECT l.sml_item_id AS item, l.sml_godown_id AS godown, l.sml_bucket::text AS bucket,
           SUM(l.sml_signed_base_qty) AS q, COUNT(*)::int AS n
      FROM stock.stock_ledger l
     WHERE l.sml_company_id = ${s.companyId}::uuid
       AND l.sml_branch_id = ${s.branchId}::uuid
       AND l.sml_is_deleted = false
       AND l.sml_doc_date > ${s.to}::date
       ${itemIn('l.sml_item_id', s)}
     GROUP BY 1, 2, 3`;
}
function transitNowSql(s, dir) {
    const side = dir === 'in'
        ? client_1.Prisma.sql `AND t.stt_to_branch_id = ${s.branchId}::uuid`
        : dir === 'out'
            ? client_1.Prisma.sql `AND t.stt_from_branch_id = ${s.branchId}::uuid`
            : client_1.Prisma.empty;
    return client_1.Prisma.sql `
    ${hasItemFilter(s) ? client_1.Prisma.sql `WITH RECURSIVE ${itemFilterCtes(s)}` : client_1.Prisma.empty}
    SELECT t.stt_out_voucher_id AS out_id, t.stt_out_refno::text AS doc_no,
           t.stt_from_branch_id AS from_branch, fb.br_name AS from_branch_name,
           t.stt_to_branch_id AS to_branch, tb.br_name AS to_branch_name,
           t.stt_to_godown_id AS to_godown, t.stt_item_id AS item, t.stt_bucket::text AS bucket,
           (t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty) AS q,
           ROUND((t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty)
                 * ${client_1.Prisma.raw(s.wot ? 't.stt_cost_rate_wot' : 't.stt_cost_rate')}, 2) AS v
      FROM stock.stock_transit t
      LEFT JOIN public.branch_master fb ON fb.br_id = t.stt_from_branch_id
      LEFT JOIN public.branch_master tb ON tb.br_id = t.stt_to_branch_id
     WHERE t.stt_company_id = ${s.companyId}::uuid
       AND t.stt_is_deleted = false
       AND t.stt_status IN ('IN_TRANSIT', 'PARTIAL')
       AND (t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty) <> 0
       ${side}
       ${s.bucket ? client_1.Prisma.sql `AND t.stt_bucket = ${s.bucket}` : client_1.Prisma.empty}
       ${itemIn('t.stt_item_id', s)}`;
}
function transitReplaySql(s, fromBranch) {
    const v = (0, item_ledger_sql_1.costValueCol)('l', s.wot);
    return client_1.Prisma.sql `
    ${withItems(s)}
    snt AS (
      SELECT v.svh_id AS out_id, v.svh_acc_year AS out_year, v.svh_refno::text AS doc_no,
             v.svh_branch_id AS from_branch, v.svh_to_branch_id AS to_branch,
             l.sml_item_id AS item, MIN(l.sml_bucket::text) AS bucket,
             -SUM(l.sml_signed_base_qty) AS q, -SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
        JOIN stock.stock_voucher v
          ON v.svh_id = l.sml_src_doc_id
         AND v.svh_acc_year = COALESCE(l.sml_src_acc_year, l.sml_acc_year)
       WHERE l.sml_company_id = ${s.companyId}::uuid
         ${fromBranch ? client_1.Prisma.sql `AND l.sml_branch_id = ${fromBranch}::uuid` : client_1.Prisma.empty}
         AND l.sml_is_deleted = false
         AND l.sml_txn_type = 'TRANSFER_OUT' AND l.sml_src_doc_type = 'TRANSFER_OUT'
         AND l.sml_doc_date <= ${s.to}::date
         AND v.svh_to_branch_id IS NOT NULL AND v.svh_to_branch_id <> v.svh_branch_id
         ${itemIn('l.sml_item_id', s)}
       GROUP BY 1, 2, 3, 4, 5, 6),
    rcv AS (
      SELECT iv.svh_link_src_doc_id AS out_id, iv.svh_link_src_acc_year AS out_year,
             l.sml_item_id AS item, SUM(l.sml_signed_base_qty) AS q
        FROM stock.stock_ledger l
        JOIN stock.stock_voucher iv
          ON iv.svh_id = l.sml_src_doc_id
         AND iv.svh_acc_year = COALESCE(l.sml_src_acc_year, l.sml_acc_year)
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_txn_type = 'TRANSFER_IN' AND l.sml_src_doc_type = 'TRANSFER_IN'
         AND l.sml_doc_date <= ${s.to}::date
         AND iv.svh_link_src_doc_type = 'STOCK_VOUCHER'
         AND (iv.svh_link_src_doc_id, iv.svh_link_src_acc_year) IN (SELECT out_id, out_year FROM snt)
       GROUP BY 1, 2, 3),
    sht AS (
      SELECT t.stt_out_voucher_id AS out_id, t.stt_out_acc_year AS out_year, t.stt_item_id AS item,
             SUM(t.stt_short_qty) AS q
        FROM stock.stock_transit t
       WHERE t.stt_company_id = ${s.companyId}::uuid
         AND t.stt_is_deleted = false
         AND t.stt_status <> 'CANCELLED'
         AND (t.stt_out_voucher_id, t.stt_out_acc_year) IN (SELECT out_id, out_year FROM snt)
         AND EXISTS (
           SELECT 1 FROM public.txn_status_log c
            WHERE c.tsl_src_module = 'INVENTORY' AND c.tsl_src_doc_type = 'STOCK_TRANSFER'
              AND c.tsl_src_doc_id = t.stt_out_voucher_id AND c.tsl_event = 'CLOSED'
              AND c.tsl_is_deleted = false
              AND (c.tsl_changed_on AT TIME ZONE 'Asia/Kolkata')::date <= ${s.to}::date)
       GROUP BY 1, 2, 3)
    SELECT snt.out_id, snt.doc_no, snt.from_branch, fb.br_name AS from_branch_name,
           snt.to_branch, tb.br_name AS to_branch_name, NULL::uuid AS to_godown,
           snt.item, snt.bucket,
           snt.q - COALESCE(rcv.q, 0) - COALESCE(sht.q, 0) AS q,
           CASE WHEN snt.q = 0 THEN 0::numeric
                ELSE ROUND((snt.q - COALESCE(rcv.q, 0) - COALESCE(sht.q, 0)) * snt.v / snt.q, 2) END AS v
      FROM snt
      LEFT JOIN rcv ON rcv.out_id = snt.out_id AND rcv.out_year = snt.out_year AND rcv.item = snt.item
      LEFT JOIN sht ON sht.out_id = snt.out_id AND sht.out_year = snt.out_year AND sht.item = snt.item
      LEFT JOIN public.branch_master fb ON fb.br_id = snt.from_branch
      LEFT JOIN public.branch_master tb ON tb.br_id = snt.to_branch
     WHERE snt.q - COALESCE(rcv.q, 0) - COALESCE(sht.q, 0) <> 0
       ${s.bucket ? client_1.Prisma.sql `AND snt.bucket = ${s.bucket}` : client_1.Prisma.empty}`;
}
function branchesNowSql(s) {
    const value = client_1.Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value');
    return client_1.Prisma.sql `
    ${hasItemFilter(s) ? client_1.Prisma.sql `WITH RECURSIVE ${itemFilterCtes(s)}` : client_1.Prisma.empty}
    SELECT b.sbl_branch_id AS branch, b.sbl_item_id AS item,
           SUM(b.sbl_on_hand_qty) AS q, SUM(${value}) AS v
      FROM stock.stock_balance b
     WHERE b.sbl_company_id = ${s.companyId}::uuid
       AND b.sbl_is_deleted = false
       ${s.bucket ? client_1.Prisma.sql `AND b.sbl_bucket = ${s.bucket}` : client_1.Prisma.empty}
       ${itemIn('b.sbl_item_id', s)}
     GROUP BY 1, 2
    HAVING SUM(b.sbl_on_hand_qty) <> 0 OR SUM(${value}) <> 0`;
}
function branchesReplaySql(s) {
    const v = (0, item_ledger_sql_1.costValueCol)('l', s.wot);
    return client_1.Prisma.sql `
    ${withItems(s)}
    ch AS (
      SELECT l.sml_branch_id AS branch, l.sml_item_id AS item, l.sml_lot_id AS lot,
             l.sml_godown_id AS godown, l.sml_bucket::text AS bucket,
             SUM(l.sml_signed_base_qty) AS q, SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date <= ${s.to}::date
         ${itemIn('l.sml_item_id', s)}
       GROUP BY 1, 2, 3, 4, 5),
    ${(0, stock_valuation_sql_1.poolValuationCtes)({ holdings: 'ch', prefix: 'bv', companyId: s.companyId, asOf: s.to, wot: s.wot })}
    SELECT branch, item, SUM(q) AS q, SUM(value) AS v
      FROM bv_val
     WHERE true ${s.bucket ? client_1.Prisma.sql `AND bucket = ${s.bucket}` : client_1.Prisma.empty}
     GROUP BY 1, 2
    HAVING SUM(q) <> 0 OR SUM(value) <> 0`;
}
function companyBranchesSql(companyId) {
    return client_1.Prisma.sql `
    SELECT br_id AS branch_id, br_name AS name
      FROM public.branch_master
     WHERE br_comp_id = ${companyId}::uuid AND COALESCE(br_is_deleted, false) = false
     ORDER BY lower(br_name), br_id`;
}
function lotsNowSql(s, itemId) {
    return client_1.Prisma.sql `
    SELECT b.sbl_godown_id AS godown_id, g.gdl_name AS godown_name, b.sbl_bucket::text AS bucket,
           b.sbl_lot_id AS lot_id,
           COALESCE(NULLIF(lt.slt_batch_no, ''), NULLIF(b.sbl_batch_no, '')) AS batch_no,
           COALESCE(lt.slt_mrp, b.sbl_mrp) AS mrp,
           COALESCE(lt.slt_expiry_date, b.sbl_expiry_date)::text AS expiry,
           sp.led_name AS supplier,
           b.sbl_on_hand_qty AS on_hand, b.sbl_reserved_qty AS reserved,
           b.sbl_available_qty AS available,
           ${client_1.Prisma.raw(s.wot ? 'b.sbl_avg_cost_rate_wot' : 'b.sbl_avg_cost_rate')} AS cost_rate,
           ${client_1.Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value')} AS value
      FROM stock.stock_balance b
      LEFT JOIN inventory.godown_locations g ON g.gdl_id = b.sbl_godown_id
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = b.sbl_lot_id
      LEFT JOIN accounts.acc_ledger_master sp ON sp.led_id = COALESCE(lt.slt_supplier_id, b.sbl_supplier_id)
     WHERE b.sbl_company_id = ${s.companyId}::uuid
       AND b.sbl_branch_id = ${s.branchId}::uuid
       AND b.sbl_item_id = ${itemId}::uuid
       AND b.sbl_is_deleted = false
       AND (b.sbl_on_hand_qty <> 0 OR b.sbl_reserved_qty <> 0)
     ORDER BY g.gdl_sort NULLS LAST, g.gdl_name, b.sbl_bucket,
              COALESCE(lt.slt_expiry_date, b.sbl_expiry_date) NULLS LAST, b.sbl_lot_id`;
}
function lotNamesSql(lotIds, godownIds) {
    return client_1.Prisma.sql `
    SELECT 'L'::text AS k, lt.slt_id AS id, NULLIF(btrim(lt.slt_batch_no), '') AS batch_no,
           lt.slt_mrp AS mrp, lt.slt_expiry_date::text AS expiry, sp.led_name AS supplier,
           NULL::text AS name, NULL::int AS sort
      FROM stock.stock_lot lt
      LEFT JOIN accounts.acc_ledger_master sp ON sp.led_id = lt.slt_supplier_id
     WHERE lt.slt_id = ANY(${lotIds}::uuid[])
    UNION ALL
    SELECT 'G', g.gdl_id, NULL, NULL, NULL, NULL, g.gdl_name, g.gdl_sort
      FROM inventory.godown_locations g
     WHERE g.gdl_id = ANY(${godownIds}::uuid[])`;
}
function lastPurchaseSql(s, itemId) {
    return client_1.Prisma.sql `
    SELECT x.sml_doc_date::text AS d, x.sml_src_refno::text AS doc_no,
           ${client_1.Prisma.raw(s.wot ? 'x.sml_cost_rate_wot' : 'x.sml_cost_rate')} AS rate
      FROM stock.stock_ledger x
     WHERE x.sml_company_id = ${s.companyId}::uuid
       AND x.sml_branch_id = ${s.branchId}::uuid
       AND x.sml_item_id = ${itemId}::uuid
       AND x.sml_is_deleted = false
       AND x.sml_txn_type = 'PURCHASE'
       AND x.sml_is_reversal = false
       AND x.sml_doc_date <= ${s.to}::date
       AND NOT EXISTS (
         SELECT 1 FROM stock.stock_ledger y
          WHERE y.sml_reverses_id = x.sml_id AND y.sml_acc_year = x.sml_acc_year
            AND y.sml_is_reversal = true AND y.sml_is_deleted = false)
     ORDER BY x.sml_doc_datetime DESC, x.sml_id DESC
     LIMIT 1`;
}
function bndNowSql(s) {
    return client_1.Prisma.sql `
    ${withItems(s)} op AS (${(0, delivery_pending_sql_1.pendingLinesCte)(s.companyId, s.branchId, itemIn('i.sbi_item_id', s))})
    SELECT op.item_id AS item, op.godown_id AS godown, op.bucket::text AS bucket,
           SUM(op.pending_base) AS bnd
      FROM op
     GROUP BY op.item_id, op.godown_id, op.bucket
    HAVING SUM(op.pending_base) <> 0`;
}
//# sourceMappingURL=stock-summary.sql.js.map