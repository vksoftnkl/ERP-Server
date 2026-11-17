"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_STATUSES_SQL = exports.WAITING_MODES_SQL = void 0;
exports.eligibleLineWhere = eligibleLineWhere;
exports.eligibleLineExpr = eligibleLineExpr;
exports.lineFactorSql = lineFactorSql;
exports.lineUnitKgSql = lineUnitKgSql;
exports.lineEventSumsLateral = lineEventSumsLateral;
exports.pendingLinesCte = pendingLinesCte;
const client_1 = require("@prisma/client");
exports.WAITING_MODES_SQL = client_1.Prisma.sql `('PICKUP', 'DISPATCH')`;
exports.OPEN_STATUSES_SQL = client_1.Prisma.sql `('PENDING', 'PART', 'OUT')`;
function eligibleLineWhere(b = 'b', i = 'i') {
    const B = client_1.Prisma.raw(b);
    const I = client_1.Prisma.raw(i);
    return client_1.Prisma.sql `${B}.sb_is_deleted = false
     AND ${B}.sb_status = 'POSTED'
     AND ${B}.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND ${I}.sbi_is_deleted = false
     AND ${I}.sbi_is_service = false
     AND COALESCE(${I}.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND ${I}.sbi_bill_qty > 0`;
}
function eligibleLineExpr(b = 'b', i = 'i') {
    return client_1.Prisma.sql `(${eligibleLineWhere(b, i)})`;
}
function lineFactorSql(i = 'i', u = 'u') {
    const I = client_1.Prisma.raw(i);
    const U = client_1.Prisma.raw(u);
    return client_1.Prisma.sql `(CASE WHEN ${I}.sbi_to_base_factor > 0 THEN ${I}.sbi_to_base_factor
              ELSE COALESCE(NULLIF(${U}.iuc_to_base_factor, 0), 1) END)`;
}
function lineUnitKgSql(i = 'i', u = 'u') {
    const I = client_1.Prisma.raw(i);
    const U = client_1.Prisma.raw(u);
    return client_1.Prisma.sql `(CASE WHEN ${I}.sbi_weight_qty > 0 AND ${I}.sbi_bill_qty > 0
              THEN ${I}.sbi_weight_qty / ${I}.sbi_bill_qty
              ELSE COALESCE(${U}.iuc_uom_weight, 0) END)`;
}
function lineEventSumsLateral(i = 'i') {
    const I = client_1.Prisma.raw(i);
    return client_1.Prisma.sql `(SELECT SUM(e.sde_settle_qty)      AS settled_qty,
                 SUM(e.sde_settle_base_qty) AS settled_base,
                 SUM(e.sde_out_qty)         AS given_qty,
                 SUM(e.sde_out_base_qty)    AS given_base
            FROM sales.sale_delivery_event e
           WHERE e.sde_bill_item_id  = ${I}.sbi_id
             AND e.sde_bill_acc_year = ${I}.sbi_acc_year
             AND e.sde_is_deleted    = false)`;
}
function pendingLinesCte(companyId, branchId, extra = client_1.Prisma.empty) {
    return client_1.Prisma.sql `
    SELECT b.sb_id AS bill_id, b.sb_acc_year AS bill_acc_year, b.sb_bill_refno AS bill_refno,
           b.sb_bill_date AS bill_date, b.sb_cust_id AS cust_id, b.sb_cust_name AS cust_name,
           b.sb_delivery_mode AS delivery_mode,
           i.sbi_id AS line_id, i.sbi_acc_year AS line_acc_year, i.sbi_line_no AS line_no,
           i.sbi_item_id AS item_id, i.sbi_item_unit_id AS unit_id, i.sbi_godown_id AS godown_id,
           i.sbi_lot_id AS lot_id, COALESCE(i.sbi_bucket, 'SALEABLE') AS bucket,
           ${lineFactorSql()} AS factor,
           ${lineUnitKgSql()} AS unit_kg,
           i.sbi_bill_qty AS billed_qty,
           COALESCE(ev.settled_qty, 0) AS settled_qty,
           COALESCE(ev.given_qty, 0) AS given_qty,
           i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
           (i.sbi_bill_qty - COALESCE(ev.settled_qty, 0)) * ${lineFactorSql()} AS pending_base
      FROM sales.sale_bill b
      JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
      LEFT JOIN LATERAL ${lineEventSumsLateral()} ev ON true
     WHERE b.sb_company_id = ${companyId}::uuid
       AND b.sb_branch_id  = ${branchId}::uuid
       AND b.sb_delivery_status IN ${exports.OPEN_STATUSES_SQL}
       AND ${eligibleLineWhere()}
       AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) <> 0
       ${extra}`;
}
//# sourceMappingURL=delivery-pending.sql.js.map