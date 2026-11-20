"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitRowsInUse = unitRowsInUse;
exports.rowUnitLock = rowUnitLock;
const client_1 = require("@prisma/client");
const UNIT_ROW_USES = [
    { table: 'stock.stock_ledger', column: 'sml_uom_id', deleted: 'sml_is_deleted', usedBy: 'stock' },
    {
        table: 'stock.stock_voucher_item',
        column: 'svi_uom_id',
        deleted: 'svi_is_deleted',
        usedBy: 'stock voucher',
    },
    {
        table: 'sales.sale_bill_item',
        column: 'sbi_item_unit_id',
        deleted: 'sbi_is_deleted',
        usedBy: 'sale bill',
    },
    {
        table: 'sales.sale_order_item',
        column: 'soi_item_unit_id',
        deleted: 'soi_is_deleted',
        usedBy: 'sale order',
    },
    {
        table: 'sales.sale_quotation_item',
        column: 'sqi_item_unit_id',
        deleted: 'sqi_is_deleted',
        usedBy: 'quotation',
    },
    {
        table: 'sales.sale_return_item',
        column: 'sri_item_unit_id',
        deleted: 'sri_is_deleted',
        usedBy: 'sale return',
    },
    {
        table: 'sales.sale_dc_item',
        column: 'sdi_item_unit_id',
        deleted: 'sdi_is_deleted',
        usedBy: 'delivery challan',
    },
    {
        table: 'sales.sale_dc_return_item',
        column: 'sdri_item_unit_id',
        deleted: 'sdri_is_deleted',
        usedBy: 'challan return',
    },
    {
        table: 'sales.sale_delivery_note_item',
        column: 'sdni_item_unit_id',
        deleted: 'sdni_is_deleted',
        usedBy: 'delivery note',
    },
    {
        table: 'sales.loyalty_gift_redeem_item',
        column: 'lgd_unit_id',
        deleted: 'lgd_is_deleted',
        usedBy: 'gift redemption',
    },
    {
        table: 'purchase.pur_order_item',
        column: 'poi_uom_id',
        deleted: 'poi_is_deleted',
        usedBy: 'purchase order',
    },
    { table: 'purchase.pur_grn_item', column: 'gri_uom_id', deleted: 'gri_is_deleted', usedBy: 'GRN' },
    {
        table: 'purchase.pur_invoice_item',
        column: 'pii_uom_id',
        deleted: 'pii_is_deleted',
        usedBy: 'purchase invoice',
    },
    {
        table: 'purchase.pur_shortage_receipt_item',
        column: 'psri_uom_id',
        deleted: 'psri_is_deleted',
        usedBy: 'shortage receipt',
    },
    {
        table: 'purchase.pur_return_item',
        column: 'pri_uom_id',
        deleted: 'pri_is_deleted',
        usedBy: 'purchase return',
    },
    {
        table: 'accounts.acc_voucher_doc_detail',
        column: 'vtx_unit_id',
        deleted: 'vtx_is_deleted',
        usedBy: 'accounts voucher',
    },
];
const USED_BY_ORDER = new Map(UNIT_ROW_USES.map((use, index) => [use.usedBy, index]));
async function unitRowsInUse(client, itemId) {
    const ids = (await client.itemUnitConversion.findMany({
        where: { iucItemId: itemId },
        select: { iucId: true },
    })).map((row) => row.iucId);
    if (ids.length === 0) {
        return { byRow: new Map(), itemUsed: false, itemUsedBy: [] };
    }
    const branches = UNIT_ROW_USES.map((use) => client_1.Prisma.sql `
      SELECT DISTINCT x.${client_1.Prisma.raw(use.column)}::text AS iuc_id, ${use.usedBy}::text AS used_by
        FROM ${client_1.Prisma.raw(use.table)} x
       WHERE x.${client_1.Prisma.raw(use.column)} = ANY(${ids}::uuid[])
         AND x.${client_1.Prisma.raw(use.deleted)} = false`);
    const rows = await client.$queryRaw `${client_1.Prisma.join(branches, ' UNION ALL ')}`;
    const byRow = new Map();
    const all = new Set();
    for (const row of rows) {
        const kinds = byRow.get(row.iuc_id) ?? [];
        if (!kinds.includes(row.used_by))
            kinds.push(row.used_by);
        byRow.set(row.iuc_id, kinds);
        all.add(row.used_by);
    }
    const ordered = (kinds) => [...kinds].sort((a, b) => (USED_BY_ORDER.get(a) ?? 99) - (USED_BY_ORDER.get(b) ?? 99));
    for (const [iucId, kinds] of byRow)
        byRow.set(iucId, ordered(kinds));
    return { byRow, itemUsed: byRow.size > 0, itemUsedBy: ordered(all) };
}
function rowUnitLock(inUse, row) {
    if (row.iuc_is_base_unit) {
        return { locked: inUse.itemUsed, usedBy: inUse.itemUsedBy };
    }
    const usedBy = inUse.byRow.get(row.iuc_id) ?? [];
    return { locked: usedBy.length > 0, usedBy };
}
//# sourceMappingURL=item-unit-in-use.helper.js.map