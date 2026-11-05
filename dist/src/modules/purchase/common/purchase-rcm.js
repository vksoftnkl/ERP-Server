"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RCM_UNREGISTERED_NOTIFIED = void 0;
exports.assertNoUnregisteredRcm = assertNoUnregisteredRcm;
const purchase_errors_1 = require("./purchase.errors");
exports.RCM_UNREGISTERED_NOTIFIED = 'RCM_UNREGISTERED_NOTIFIED';
const FALLBACK = [
    { prefix: '7204', description: 'Ferrous waste and scrap', from: '2024-10-10' },
    { prefix: '7404', description: 'Copper waste and scrap', from: '2024-10-10' },
    { prefix: '7503', description: 'Nickel waste and scrap', from: '2024-10-10' },
    { prefix: '7602', description: 'Aluminium waste and scrap', from: '2024-10-10' },
    { prefix: '7802', description: 'Lead waste and scrap', from: '2024-10-10' },
    { prefix: '7902', description: 'Zinc waste and scrap', from: '2024-10-10' },
    { prefix: '8002', description: 'Tin waste and scrap', from: '2024-10-10' },
];
async function notifiedList(tx, companyId, onDate) {
    const [t] = await tx.$queryRaw `SELECT to_regclass('purchase.pur_rcm_notified_hsn') IS NOT NULL AS ok`;
    if (!t?.ok)
        return FALLBACK.filter((f) => f.from <= onDate);
    const rows = await tx.$queryRaw `
    SELECT rnh_hsn_prefix AS prefix, rnh_description AS description FROM purchase.pur_rcm_notified_hsn
     WHERE rnh_is_active AND (rnh_company_id IS NULL OR rnh_company_id = ${companyId}::uuid)
       AND rnh_effective_from <= ${onDate}::date AND (rnh_effective_to IS NULL OR rnh_effective_to >= ${onDate}::date)`;
    return rows.map((r) => ({ ...r, from: onDate }));
}
async function assertNoUnregisteredRcm(tx, a, lines) {
    const [s] = await tx.$queryRaw `
    SELECT sup_name, sup_gst_no, sup_gst_type FROM purchase.suppliers WHERE sup_id = ${a.supplierId}::uuid`;
    if (!s)
        return;
    const unregistered = !(s.sup_gst_no ?? '').trim() || /unregist/i.test(s.sup_gst_type ?? '');
    if (!unregistered || !lines.length)
        return;
    const list = await notifiedList(tx, a.companyId, a.docDate);
    if (!list.length)
        return;
    const items = await tx.$queryRaw `
    SELECT item_id, item_name_en AS item_name, regexp_replace(coalesce(item_hsn_code, ''), '[^0-9]', '', 'g') AS hsn
      FROM inventory.item_master WHERE item_id = ANY(${[...new Set(lines.map((l) => l.itemId))]}::uuid[])`;
    const byItem = new Map(items.map((i) => [i.item_id, i]));
    for (const l of lines) {
        const it = byItem.get(l.itemId);
        const hit = it?.hsn ? list.find((n) => it.hsn.startsWith(n.prefix)) : undefined;
        if (hit)
            (0, purchase_errors_1.purRefuse)(`Line ${l.lineNo}: ${it.item_name} (HSN ${it.hsn}, ${hit.description}) from an unregistered supplier is under reverse charge — `
                + 'the RCM self-invoice comes in phase 2. Enter it through Expense Voucher (RCM), or buy from a registered supplier.', exports.RCM_UNREGISTERED_NOTIFIED, `lines.${l.lineNo - 1}.itemId`);
    }
}
//# sourceMappingURL=purchase-rcm.js.map