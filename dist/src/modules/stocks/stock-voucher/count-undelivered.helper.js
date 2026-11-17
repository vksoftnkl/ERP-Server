"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.undeliveredKey = undeliveredKey;
exports.readHoldingUndelivered = readHoldingUndelivered;
exports.readSellUnits = readSellUnits;
exports.countedFromShelf = countedFromShelf;
const client_1 = require("@prisma/client");
const delivery_pending_sql_1 = require("../../sales/delivery/core/delivery-pending.sql");
const D0 = new client_1.Prisma.Decimal(0);
function undeliveredKey(godownId, itemId, lotId, bucket) {
    return `${godownId}|${itemId}|${lotId ?? ''}|${bucket ?? 'SALEABLE'}`;
}
async function readHoldingUndelivered(client, scope) {
    const out = new Map();
    if (scope.godownIds.length === 0 || scope.itemIds.length === 0) {
        return out;
    }
    const rows = await client.$queryRaw `
    WITH op AS (${(0, delivery_pending_sql_1.pendingLinesCte)(scope.companyId, scope.branchId, client_1.Prisma.sql `AND i.sbi_godown_id = ANY(${[...new Set(scope.godownIds)]}::uuid[])
                 AND i.sbi_item_id = ANY(${[...new Set(scope.itemIds)]}::uuid[])`)})
    SELECT op.bill_id, btrim(op.bill_acc_year) AS bill_acc_year, op.bill_refno,
           COALESCE(c.cus_name, op.cust_name) AS cust_name,
           op.godown_id, op.item_id, op.lot_id, op.bucket,
           op.pending_qty, op.pending_base, um.unit_name
      FROM op
      LEFT JOIN sales.customers c ON c.cus_id = op.cust_id
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = op.unit_id
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     ORDER BY op.bill_date, op.bill_refno, op.line_no`;
    for (const r of rows) {
        const key = undeliveredKey(r.godown_id, r.item_id, r.lot_id, r.bucket);
        const h = out.get(key) ?? { bndBase: D0, bills: [] };
        h.bndBase = h.bndBase.plus(r.pending_base ?? D0);
        if (scope.withBills) {
            h.bills.push({
                billId: r.bill_id,
                billAccYear: r.bill_acc_year,
                billRefno: r.bill_refno,
                custName: r.cust_name,
                qty: Number(r.pending_qty),
                unitName: r.unit_name,
                baseQty: Number(r.pending_base),
            });
        }
        out.set(key, h);
    }
    return out;
}
async function readSellUnits(client, itemIds) {
    const out = new Map();
    if (itemIds.length === 0) {
        return out;
    }
    const rows = await client.$queryRaw `
    SELECT im.item_id,
           COALESCE(su.unit_name, bu.unit_name) AS unit_name,
           COALESCE(dfl.factor, 1) AS factor
      FROM inventory.item_master im
      LEFT JOIN LATERAL (
        SELECT COALESCE(NULLIF(x.iuc_to_base_factor, 0), 1) AS factor, x.iuc_unit_id
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = im.item_id AND x.iuc_is_default_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno
         LIMIT 1) dfl ON true
      LEFT JOIN LATERAL (
        SELECT x.iuc_unit_id
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = im.item_id AND x.iuc_is_base_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno
         LIMIT 1) bw ON true
      LEFT JOIN inventory.item_unit_master su ON su.unit_id = dfl.iuc_unit_id
      LEFT JOIN inventory.item_unit_master bu
             ON bu.unit_id = COALESCE(im.item_base_unit_id, bw.iuc_unit_id)
     WHERE im.item_id = ANY(${[...new Set(itemIds)]}::uuid[])`;
    for (const r of rows) {
        out.set(r.item_id, { name: r.unit_name, factor: Number(r.factor ?? 1) });
    }
    return out;
}
function countedFromShelf(shelf, undelivered) {
    return shelf.minus(undelivered);
}
//# sourceMappingURL=count-undelivered.helper.js.map