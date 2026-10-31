"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUR_CHECK = void 0;
exports.rateRefs = rateRefs;
exports.serialFacts = serialFacts;
exports.stockMrps = stockMrps;
exports.judgeLines = judgeLines;
exports.checkLines = checkLines;
const client_1 = require("@prisma/client");
const stock_voucher_posting_helper_1 = require("../../stocks/stock-voucher/stock-voucher-posting.helper");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.PUR_CHECK = {
    RATE_ABOVE_PO: 'PUR_RATE_ABOVE_PO',
    RATE_ABOVE_LAST: 'PUR_RATE_ABOVE_LAST',
    SHORT_QTY: 'PUR_SHORT_QTY',
    SERIAL_COUNT: 'PUR_SERIAL_COUNT',
    SERIAL_DUPLICATE: 'PUR_SERIAL_DUPLICATE',
    PRICE_BELOW_COST: 'PUR_PRICE_BELOW_COST',
    PRICE_ABOVE_MRP: 'PUR_PRICE_ABOVE_MRP',
    RCM_NOT_SUPPORTED: 'PUR_RCM_NOT_SUPPORTED',
};
const pct = (v) => v.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
const perBase = (taxable, billed, factor) => billed.isZero() || factor.isZero() ? null : taxable.dividedBy(billed.times(factor));
async function rateRefs(tx, companyId, exceptPiId, facts) {
    const out = new Map();
    const viaGrn = facts.filter((f) => f.srcType === 'GRN' && f.srcItemId);
    const direct = facts.filter((f) => f.srcType === 'PURCHASE_ORDER' && f.srcItemId);
    if (viaGrn.length) {
        const rows = await tx.$queryRaw `
      SELECT gri.gri_id, po.po_refno, poi.poi_taxable_amt / NULLIF(poi.poi_qty * poi.poi_to_base_factor, 0) AS po_rate_base
        FROM purchase.pur_grn_item gri
        JOIN purchase.pur_order_item poi ON poi.poi_id = gri.gri_src_item_id AND gri.gri_src_doc_type = 'PURCHASE_ORDER'
        JOIN purchase.pur_order po ON po.po_id = poi.poi_po_id AND po.po_acc_year = poi.poi_acc_year
       WHERE gri.gri_id = ANY(${viaGrn.map((f) => f.srcItemId)}::uuid[])`;
        for (const f of viaGrn) {
            const r = rows.find((x) => x.gri_id === f.srcItemId);
            if (r?.po_rate_base && !(0, purchase_doc_helpers_1.D)(r.po_rate_base).isZero())
                out.set(f.lineNo, { basis: 'PO', refno: r.po_refno, refBase: (0, purchase_doc_helpers_1.D)(r.po_rate_base) });
        }
    }
    if (direct.length) {
        const rows = await tx.$queryRaw `
      SELECT poi.poi_id, po.po_refno, poi.poi_taxable_amt / NULLIF(poi.poi_qty * poi.poi_to_base_factor, 0) AS po_rate_base
        FROM purchase.pur_order_item poi
        JOIN purchase.pur_order po ON po.po_id = poi.poi_po_id AND po.po_acc_year = poi.poi_acc_year
       WHERE poi.poi_id = ANY(${direct.map((f) => f.srcItemId)}::uuid[])`;
        for (const f of direct) {
            const r = rows.find((x) => x.poi_id === f.srcItemId);
            if (r?.po_rate_base && !(0, purchase_doc_helpers_1.D)(r.po_rate_base).isZero())
                out.set(f.lineNo, { basis: 'PO', refno: r.po_refno, refBase: (0, purchase_doc_helpers_1.D)(r.po_rate_base) });
        }
    }
    const rest = [...new Set(facts.filter((f) => !out.has(f.lineNo)).map((f) => f.itemId))];
    if (rest.length) {
        const rows = await tx.$queryRaw `
      SELECT DISTINCT ON (pii.pii_item_id) pii.pii_item_id AS item_id, pi.pi_refno,
             pii.pii_taxable_amt / NULLIF(pii.pii_billed_qty * pii.pii_to_base_factor, 0) AS rate_base
        FROM purchase.pur_invoice_item pii
        JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
       WHERE pi.pi_company_id = ${companyId}::uuid AND pii.pii_item_id = ANY(${rest}::uuid[])
         AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted AND pii.pii_billed_qty > 0
         AND pi.pi_id IS DISTINCT FROM ${exceptPiId}::uuid
       ORDER BY pii.pii_item_id, pi.pi_doc_date DESC, pi.pi_created_on DESC`;
        const byItem = new Map(rows.map((r) => [r.item_id, r]));
        for (const f of facts) {
            if (out.has(f.lineNo))
                continue;
            const r = byItem.get(f.itemId);
            if (r?.rate_base && !(0, purchase_doc_helpers_1.D)(r.rate_base).isZero())
                out.set(f.lineNo, { basis: 'LAST', refno: r.pi_refno, refBase: (0, purchase_doc_helpers_1.D)(r.rate_base) });
        }
    }
    return out;
}
async function serialFacts(tx, companyId, branchId, docDate, facts) {
    const itemIds = [...new Set(facts.map((f) => f.itemId))];
    const tracked = new Set();
    if (itemIds.length) {
        const rows = await tx.$queryRaw `
      SELECT itm.item_id, COALESCE(stp.stp_track_serial, false) AS track_serial
        FROM inventory.item_master itm
        ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({ companyId: client_1.Prisma.sql `${companyId}::uuid`, branchId: client_1.Prisma.sql `${branchId}::uuid`, itemId: client_1.Prisma.raw('itm.item_id'),
            itemGroupId: client_1.Prisma.raw('itm.item_group_id'), onDate: client_1.Prisma.sql `${docDate}::date` })}
       WHERE itm.item_id = ANY(${itemIds}::uuid[])`;
        for (const r of rows)
            if (r.track_serial)
                tracked.add(r.item_id);
    }
    const keyed = facts.flatMap((f) => f.serials.map((s) => ({ itemId: f.itemId, key: s.trim().toUpperCase() }))).filter((x) => x.key);
    const onHand = new Set();
    if (keyed.length) {
        const rows = await tx.$queryRaw `
      SELECT slt.slt_item_id AS item_id, slt.slt_key_serial AS key
        FROM stock.stock_lot slt
        JOIN stock.stock_balance sbl ON sbl.sbl_lot_id = slt.slt_id AND NOT sbl.sbl_is_deleted
       WHERE slt.slt_company_id = ${companyId}::uuid AND NOT slt.slt_is_deleted
         AND slt.slt_item_id = ANY(${keyed.map((k) => k.itemId)}::uuid[]) AND slt.slt_key_serial = ANY(${keyed.map((k) => k.key)}::text[])
       GROUP BY 1, 2 HAVING SUM(sbl.sbl_on_hand_qty) > 0`;
        for (const r of rows)
            onHand.add(`${r.item_id}|${r.key}`);
    }
    return { tracked, onHand };
}
async function stockMrps(tx, companyId, branchId, itemIds) {
    const out = new Map();
    if (!itemIds.length)
        return out;
    const rows = await tx.$queryRaw `
    SELECT sbl_item_id AS item_id, sbl_mrp AS mrp FROM stock.stock_balance
     WHERE sbl_company_id = ${companyId}::uuid AND sbl_branch_id = ${branchId}::uuid AND sbl_item_id = ANY(${[...new Set(itemIds)]}::uuid[])
       AND sbl_bucket = 'SALEABLE' AND NOT sbl_is_deleted AND sbl_mrp IS NOT NULL
     GROUP BY 1, 2 HAVING SUM(sbl_on_hand_qty) > 0 ORDER BY 1, 2`;
    for (const r of rows)
        out.set(r.item_id, [...(out.get(r.item_id) ?? []), (0, purchase_doc_helpers_1.D)(r.mrp)]);
    return out;
}
function judgeLines(facts, refs, tolerancePct, serial, mrps) {
    const tol = (0, purchase_doc_helpers_1.D)(tolerancePct);
    const issues = [];
    const checks = new Map();
    const seen = new Map();
    for (const f of facts) {
        const name = f.itemName ? ` ${f.itemName}` : '';
        let rate = null;
        const ref = refs.get(f.lineNo);
        const bill = perBase(f.taxable, f.billed, f.factor);
        if (ref && bill) {
            const diff = bill.minus(ref.refBase).dividedBy(ref.refBase).times(100);
            const over = diff.greaterThan(tol);
            rate = { basis: ref.basis, refno: ref.refno, refRate: ref.refBase.times(f.factor).toFixed(2), billRate: bill.times(f.factor).toFixed(2),
                diffPct: pct(diff), tolerancePct: tol.toString(), over };
            if (over && ref.basis === 'PO') {
                issues.push({ code: 'PUR_RATE_ABOVE_PO', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.rate`, needsRight: 'OVERRIDE',
                    message: `Line ${f.lineNo}${name}: ${rate.billRate} is ${pct(diff)} % above ${ref.refno} (${rate.refRate}, tolerance ${tol.toString()} %) — bill on PAYMENT HOLD until released (right: Release payment hold).` });
            }
            else if (over) {
                issues.push({ code: 'PUR_RATE_ABOVE_LAST', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.rate`, needsRight: null,
                    message: `Line ${f.lineNo}${name}: ${rate.billRate} is ${pct(diff)} % above the last purchase ${rate.refRate} (${ref.refno}, tolerance ${tol.toString()} %).` });
            }
        }
        if (f.pendingShort.greaterThan(0)) {
            issues.push({ code: 'PUR_SHORT_QTY', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.receivedQty`, needsRight: null,
                message: `Line ${f.lineNo}${name}: ${f.pendingShort.toString()} billed, not received → shortage row; ${f.shortValue.toFixed(2)} + GST ${f.gstOnShort.toFixed(2)} parked until the Shortage Receipt.` });
        }
        let serials = null;
        const named = f.serials.map((s) => s.trim()).filter(Boolean);
        if (serial.tracked.has(f.itemId) && f.srcType !== 'GRN') {
            serials = { have: named.length, need: f.pieces.toString() };
            if (!(0, purchase_doc_helpers_1.D)(named.length).equals(f.pieces)) {
                issues.push({ code: 'PUR_SERIAL_COUNT', level: 'REFUSE', lineNo: f.lineNo, field: `lines.${f.index}.allocs`, needsRight: null,
                    message: `Line ${f.lineNo}${name}: ${named.length} serial${named.length === 1 ? '' : 's'} for ${f.pieces.toString()} received — scan every piece (F12) before Post.` });
            }
        }
        for (const s of named) {
            const key = `${f.itemId}|${s.toUpperCase()}`;
            const first = seen.get(key);
            if (first !== undefined) {
                issues.push({ code: 'PUR_SERIAL_DUPLICATE', level: 'REFUSE', lineNo: f.lineNo, field: `lines.${f.index}.allocs`, needsRight: null,
                    message: `Line ${f.lineNo}${name}: serial ${s} is scanned twice${first !== f.lineNo ? ` (also on line ${first})` : ''}.` });
            }
            else
                seen.set(key, f.lineNo);
            if (serial.onHand.has(key)) {
                issues.push({ code: 'PUR_SERIAL_DUPLICATE', level: 'REFUSE', lineNo: f.lineNo, field: `lines.${f.index}.allocs`, needsRight: null,
                    message: `Line ${f.lineNo}${name}: serial ${s} is already in stock.` });
            }
        }
        let newMrp = null;
        const have = mrps.get(f.itemId) ?? [];
        const fresh = [...new Map(f.mrps.filter((m) => m.greaterThan(0)).map((m) => [m.toFixed(2), m])).values()].filter((m) => have.length && !have.some((h) => h.equals(m)));
        if (fresh.length)
            newMrp = { mrp: fresh.map((m) => m.toFixed(2)).join(', '), stockMrps: have.map((h) => h.toFixed(2)) };
        if (f.sellA && f.sellA.greaterThan(0)) {
            if (f.costInclUnit && f.sellA.lessThan(f.costInclUnit)) {
                issues.push({ code: 'PUR_PRICE_BELOW_COST', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.sellA`, needsRight: null,
                    message: `Line ${f.lineNo}${name}: Sell A ${f.sellA.toFixed(2)} is below the cost ${f.costInclUnit.toFixed(2)} (with tax).` });
            }
            const top = f.mrps.filter((m) => m.greaterThan(0));
            if (top.length && top.some((m) => f.sellA.greaterThan(m))) {
                issues.push({ code: 'PUR_PRICE_ABOVE_MRP', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.sellA`, needsRight: null,
                    message: `Line ${f.lineNo}${name}: Sell A ${f.sellA.toFixed(2)} is above the MRP ${top.map((m) => m.toFixed(2)).join(' / ')}.` });
            }
        }
        checks.set(f.lineNo, { rate, newMrp, priceKept: f.priceUpdateResult === 'KEPT_NEWER', serials, shortQty: f.pendingShort.toString() });
    }
    return { issues, checks };
}
async function checkLines(tx, scope, facts) {
    const [refs, serial, mrps] = await Promise.all([
        rateRefs(tx, scope.companyId, scope.piId, facts),
        serialFacts(tx, scope.companyId, scope.branchId, scope.docDate, facts),
        stockMrps(tx, scope.companyId, scope.branchId, facts.map((f) => f.itemId)),
    ]);
    return judgeLines(facts, refs, scope.tolerancePct, serial, mrps);
}
//# sourceMappingURL=purchase-invoice-checks.js.map