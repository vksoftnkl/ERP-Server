"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leftTextOf = leftTextOf;
exports.unitNamesOf = unitNamesOf;
exports.billDeliveryRead = billDeliveryRead;
exports.billGodownSlips = billGodownSlips;
exports.oldPendingDeliveries = oldPendingDeliveries;
exports.istTodayYmd = istTodayYmd;
const client_1 = require("@prisma/client");
const delivery_qr_1 = require("../delivery/core/delivery-qr");
const bill_delivery_helper_1 = require("./bill-delivery.helper");
const t = (d) => d.toDecimalPlaces(3).toString();
function leftTextOf(lines, unitNames) {
    const byUnit = new Map();
    for (const l of lines) {
        if (l.pendingQty.isZero()) {
            continue;
        }
        const name = unitNames.get(l.unitId) ?? '';
        byUnit.set(name, (byUnit.get(name) ?? new client_1.Prisma.Decimal(0)).plus(l.pendingQty));
    }
    return [...byUnit.entries()]
        .filter(([, q]) => !q.isZero())
        .map(([u, q]) => `${t(q)}${u ? ` ${u}` : ''}`)
        .join(' + ');
}
async function unitNamesOf(c, iucIds) {
    const ids = [...new Set(iucIds)];
    if (ids.length === 0) {
        return new Map();
    }
    const rows = await c.$queryRaw `
    SELECT u.iuc_id, um.unit_name
      FROM inventory.item_unit_conversion u
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     WHERE u.iuc_id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((r) => [r.iuc_id, r.unit_name ?? '']));
}
async function billDeliveryRead(c, pending, bill) {
    const all = await pending.linesOfBills(c, [{ billId: bill.sbId, billAccYear: bill.sbAccYear }]);
    const lines = all.filter((l) => l.eligible);
    const units = await unitNamesOf(c, lines.map((l) => l.unitId));
    const zero = new client_1.Prisma.Decimal(0);
    const sum = (f) => lines.reduce((a, l) => a.plus(f(l)), zero);
    const left = sum((l) => l.pendingQty);
    const leftKg = sum((l) => l.pendingQty.times(l.unitKg));
    const year = bill.sbAccYear.trim();
    const given = await c.$queryRaw `
    SELECT e.sde_src_doc_id AS src_id, e.sde_src_acc_year AS src_year,
           COALESCE(e.sde_src_refno, 'go-live') AS refno,
           MIN(e.sde_event_datetime) AS at, SUM(e.sde_out_qty) AS qty
      FROM sales.sale_delivery_event e
     WHERE e.sde_bill_id = ${bill.sbId}::uuid AND e.sde_bill_acc_year = ${year}::bpchar
       AND e.sde_kind IN ('GIVEN', 'CLEANUP', 'CANCEL', 'GOODS_BACK')
       AND e.sde_is_deleted = false
     GROUP BY e.sde_src_doc_id, e.sde_src_acc_year, COALESCE(e.sde_src_refno, 'go-live')
    HAVING SUM(e.sde_out_qty) <> 0
     ORDER BY MIN(e.sde_event_datetime)`;
    const drafts = await c.$queryRaw `
    SELECT DISTINCT n.sdn_id, n.sdn_refno, g.gdl_name AS godown_name
      FROM sales.sale_delivery_note_item ni
      JOIN sales.sale_delivery_note n ON n.sdn_id = ni.sdni_note_id AND n.sdn_acc_year = ni.sdni_acc_year
      LEFT JOIN inventory.godown_locations g ON g.gdl_id = n.sdn_godown_id
     WHERE ni.sdni_bill_id = ${bill.sbId}::uuid AND ni.sdni_bill_acc_year = ${year}::bpchar
       AND ni.sdni_is_deleted = false AND n.sdn_is_deleted = false AND n.sdn_status = 'DRAFT'`;
    const waiting = bill.sbDeliveryMode === 'PICKUP' || bill.sbDeliveryMode === 'DISPATCH';
    const days = !left.isZero() && bill.sbBillDate
        ? Math.max(0, Math.floor((todayUtcMidnight() - Date.UTC(bill.sbBillDate.getUTCFullYear(), bill.sbBillDate.getUTCMonth(), bill.sbBillDate.getUTCDate())) / 86_400_000))
        : null;
    const byLine = new Map();
    for (const l of all) {
        byLine.set(l.billItemId, {
            delivered: l.eligible ? t(l.givenQty) : '0',
            pending: l.eligible ? t(l.pendingQty) : '0',
        });
    }
    return {
        block: {
            status: bill.sbDeliveryStatus,
            mode: bill.sbDeliveryMode,
            billedPkgs: t(sum((l) => l.billedQty)),
            givenPkgs: t(sum((l) => l.givenQty)),
            leftPkgs: t(left),
            leftText: leftTextOf(lines, units),
            leftKg: t(leftKg),
            given: given.map((g) => ({
                sdnId: g.src_id,
                accYear: g.src_year?.trim() ?? null,
                refno: g.refno ?? '',
                date: g.at.toISOString(),
                text: `${t(new client_1.Prisma.Decimal(g.qty))} pkgs on ${g.refno ?? ''} · ${(0, bill_delivery_helper_1.istDateText)(g.at)}`,
            })),
            drafts: drafts.map((d) => ({
                sdnId: d.sdn_id,
                refno: d.sdn_refno,
                godownName: d.godown_name ?? '',
            })),
            oldestDays: days,
            qrToken: waiting ? (0, delivery_qr_1.encodeDeliveryQr)('BILL', bill.sbId, year) : null,
        },
        byLine,
    };
}
async function billGodownSlips(c, pending, bill) {
    if (bill.sbDeliveryMode !== 'PICKUP' && bill.sbDeliveryMode !== 'DISPATCH') {
        return [];
    }
    const lines = (await pending.linesOfBills(c, [{ billId: bill.sbId, billAccYear: bill.sbAccYear }])).filter((l) => l.eligible && !l.pendingQty.isZero());
    const count = new Map();
    for (const l of lines) {
        count.set(l.godownId, (count.get(l.godownId) ?? 0) + 1);
    }
    if (count.size === 0) {
        return [];
    }
    const rows = await c.$queryRaw `
    SELECT gdl_id, gdl_name FROM inventory.godown_locations
     WHERE gdl_id = ANY(${[...count.keys()]}::uuid[]) AND gdl_del_sheet = true
     ORDER BY gdl_name`;
    return rows.map((r) => ({
        godownId: r.gdl_id,
        godownName: r.gdl_name ?? '',
        lineCount: count.get(r.gdl_id) ?? 0,
    }));
}
async function oldPendingDeliveries(c, q) {
    const today = istTodayYmd();
    const rows = await c.$queryRaw `
    WITH op AS (
      SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, b.sb_bill_date,
             COALESCE(um.unit_name, '') AS unit_name,
             i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty
        FROM sales.sale_bill b
        JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
        LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                             FROM sales.sale_delivery_event e
                            WHERE e.sde_bill_item_id = i.sbi_id
                              AND e.sde_bill_acc_year = i.sbi_acc_year
                              AND e.sde_is_deleted = false) ev ON true
       WHERE b.sb_company_id = ${q.companyId}::uuid
         AND b.sb_branch_id = ${q.branchId}::uuid
         AND b.sb_cust_id = ${q.custId}::uuid
         AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
         AND b.sb_is_deleted = false AND b.sb_status = 'POSTED'
         AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
         AND b.sb_bill_date < ${today}::date - ${q.oldDays}::int
         AND i.sbi_is_deleted = false AND i.sbi_is_service = false
         AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
         AND i.sbi_bill_qty > 0
         AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) > 0
    ),
    by_unit AS (
      SELECT sb_id, sb_acc_year, sb_bill_refno, sb_bill_date, unit_name, SUM(pending_qty) AS q
        FROM op GROUP BY sb_id, sb_acc_year, sb_bill_refno, sb_bill_date, unit_name
    )
    SELECT sb_id, sb_acc_year, sb_bill_refno, (${today}::date - sb_bill_date)::int AS days,
           string_agg(trim_scale(round(q, 3))::text || CASE WHEN unit_name <> '' THEN ' ' || unit_name ELSE '' END,
                      ' + ' ORDER BY unit_name) AS left_text
      FROM by_unit
     GROUP BY sb_id, sb_acc_year, sb_bill_refno, sb_bill_date
     ORDER BY sb_bill_date, sb_bill_refno
     LIMIT ${q.limit ?? 20}`;
    return rows.map((r) => ({
        billId: r.sb_id,
        billAccYear: r.sb_acc_year.trim(),
        billRefno: r.sb_bill_refno,
        days: Number(r.days),
        leftText: r.left_text ?? '',
    }));
}
function istTodayYmd() {
    return new Date(todayUtcMidnight()).toISOString().slice(0, 10);
}
function todayUtcMidnight() {
    const ist = new Date(Date.now() + 330 * 60_000);
    return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}
//# sourceMappingURL=bill-delivery-read.js.map