"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.num = exports.DELIVERY_RETURN_CODES_ADDED = void 0;
exports.resolveNotTaken = resolveNotTaken;
exports.deliveryStatusOf = deliveryStatusOf;
exports.notTakenRowsOf = notTakenRowsOf;
exports.loadNotTakenLines = loadNotTakenLines;
exports.returnEventsOf = returnEventsOf;
exports.amendLockIssues = amendLockIssues;
exports.unitNamesOf = unitNamesOf;
const client_1 = require("@prisma/client");
const delivery_constants_1 = require("../delivery/core/delivery.constants");
const sale_return_money_1 = require("./sale-return-money");
const lineKey = (billItemId, billAccYear) => `${billItemId}|${billAccYear.trim()}`;
const fmt = (v) => (0, sale_return_money_1.r3)(v).toString();
exports.DELIVERY_RETURN_CODES_ADDED = {
    DELIVERY_RETURN_AMEND_LOCKED: 'DELIVERY_RETURN_AMEND_LOCKED',
};
const down3 = (v) => v.toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_DOWN);
function resolveNotTaken(rows, billLines, claim) {
    const remaining = new Map();
    const resolved = [];
    const byRule = [[], [], [], [], []];
    const perLine = new Map();
    for (const r of rows) {
        const key = r.billItemId && r.billAccYear ? lineKey(r.billItemId, r.billAccYear) : null;
        const bl = key ? (billLines.get(key) ?? null) : null;
        const qtyBase = r.qty.times(r.factor);
        const condition = (r.condition ?? 'RESTOCK').toUpperCase();
        const sameHolding = !!bl &&
            (r.godownId ?? bl.godownId) === bl.godownId &&
            (r.lotId ?? bl.lotId) === bl.lotId;
        const pendingBase = bl?.eligible ? client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, bl.pendingBase) : sale_return_money_1.ZERO;
        const left = key ? (remaining.get(key) ?? pendingBase) : sale_return_money_1.ZERO;
        let defaultBase = sale_return_money_1.ZERO;
        if (!claim && bl?.eligible && sameHolding && condition !== 'SCRAP' && left.gt(0)) {
            defaultBase = client_1.Prisma.Decimal.min(qtyBase, left);
        }
        const factor = r.factor.gt(0) ? r.factor : (0, sale_return_money_1.D)(1);
        const defaultQty = down3(defaultBase.dividedBy(factor));
        const resolvedQty = r.typed ?? defaultQty;
        const resolvedBase = resolvedQty.times(factor);
        if (key) {
            remaining.set(key, left.minus(resolvedBase));
        }
        resolved.push({
            index: r.index,
            defaultQty,
            resolvedQty,
            resolvedBase,
            billPendingQty: down3(pendingBase.dividedBy(factor)),
            billPendingBase: pendingBase,
        });
        const unit = r.unitName ?? '';
        if (r.typed !== null && r.typed.gt(r.qty)) {
            byRule[0].push({
                code: delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER_QTY,
                message: `Line ${r.lineNo}: ${fmt(r.typed)} ${unit} marked not taken, but only ${fmt(r.qty)} ${unit} are being returned`,
                field: 'sriUndeliveredQty',
                line: r.lineNo,
                params: { n: r.lineNo, u: fmt(r.typed), unit, qty: fmt(r.qty) },
            });
        }
        if (claim && resolvedQty.gt(0)) {
            byRule[1].push({
                code: delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_CLAIM,
                message: `Line ${r.lineNo}: a claim is for goods the customer had, but ${fmt(resolvedQty)} ${unit} are marked never taken`,
                field: 'sriUndeliveredQty',
                line: r.lineNo,
                params: { n: r.lineNo, u: fmt(resolvedQty), unit },
            });
        }
        if (resolvedQty.gt(0) && bl && (!sameHolding || condition === 'SCRAP')) {
            byRule[4].push({
                code: delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_GODOWN,
                message: `Line ${r.lineNo}: goods never taken stay in ${bl.godownName ?? bl.godownId}, lot ${bl.lotNo ?? '-'} (condition Good, Damaged or Expired)`,
                field: condition === 'SCRAP' ? 'sriCondition' : 'sriGodownId',
                line: r.lineNo,
                params: { n: r.lineNo, godown: bl.godownName ?? '', lot: bl.lotNo ?? '' },
            });
        }
        if (!bl || !bl.eligible) {
            if (resolvedQty.gt(0)) {
                byRule[2].push({
                    code: delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER,
                    message: `Line ${r.lineNo}: ${fmt(resolvedQty)} marked not taken, but nothing is still to give on ${bl?.billRefno ?? 'this bill line'}`,
                    field: 'sriUndeliveredQty',
                    line: r.lineNo,
                    params: { n: r.lineNo, qty: fmt(resolvedQty), pending: '0', bill: bl?.billRefno ?? '' },
                });
            }
            continue;
        }
        const acc = perLine.get(key) ?? {
            bl,
            resolvedBase: sale_return_money_1.ZERO,
            takenBase: sale_return_money_1.ZERO,
            firstLine: r.lineNo,
        };
        acc.resolvedBase = acc.resolvedBase.plus(resolvedBase);
        acc.takenBase = acc.takenBase.plus(client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, qtyBase.minus(resolvedBase)));
        perLine.set(key, acc);
    }
    const delivery = [];
    for (const { bl, resolvedBase, takenBase, firstLine } of perLine.values()) {
        const blFactor = bl.factor.gt(0) ? bl.factor : (0, sale_return_money_1.D)(1);
        const pendingBase = client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, bl.pendingBase);
        const unit = bl.unitName ?? '';
        if (resolvedBase.gt(pendingBase)) {
            byRule[2].push({
                code: delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER,
                message: `Line ${firstLine}: ${fmt(resolvedBase.dividedBy(blFactor))} ${unit} marked not taken, but only ${fmt(pendingBase.dividedBy(blFactor))} ${unit} are still to give on ${bl.billRefno ?? 'the bill'}`,
                field: 'sriUndeliveredQty',
                line: firstLine,
                params: {
                    n: firstLine,
                    qty: fmt(resolvedBase.dividedBy(blFactor)),
                    pending: fmt(pendingBase.dividedBy(blFactor)),
                    bill: bl.billRefno ?? '',
                },
            });
        }
        const available = client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, bl.givenBase.minus(bl.takenBeforeBase));
        if (takenBase.gt(available)) {
            const min = takenBase.minus(available);
            byRule[3].push({
                code: delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_NOT_GIVEN,
                message: `Line ${firstLine}: only ${fmt(available.dividedBy(blFactor))} ${unit} were given; the rest was never taken — mark at least ${fmt(min.dividedBy(blFactor))} ${unit} as not taken`,
                field: 'sriUndeliveredQty',
                line: firstLine,
                params: {
                    n: firstLine,
                    given: fmt(available.dividedBy(blFactor)),
                    min: fmt(min.dividedBy(blFactor)),
                    unit,
                },
            });
        }
        const settleBase = (0, sale_return_money_1.r6)(resolvedBase);
        delivery.push({
            billId: bl.billId,
            billAccYear: bl.billAccYear,
            billRefno: bl.billRefno,
            billItemId: bl.billItemId,
            billLineNo: bl.lineNo,
            unitName: bl.unitName,
            pendingBefore: (0, sale_return_money_1.r3)(bl.pendingBase.dividedBy(blFactor)),
            pendingAfter: (0, sale_return_money_1.r3)(bl.pendingBase.minus(resolvedBase).dividedBy(blFactor)),
            settleQty: (0, sale_return_money_1.r3)(resolvedBase.dividedBy(blFactor)),
            settleBase,
        });
    }
    return { rows: resolved, issues: byRule.flat(), delivery };
}
function deliveryStatusOf(lines, billPostedWaiting) {
    const el = lines.filter((l) => l.eligible);
    if (!billPostedWaiting || el.length === 0) {
        return 'NA';
    }
    if (el.some((l) => !l.pending.isZero())) {
        return el.some((l) => !l.settled.isZero()) ? 'PART' : 'PENDING';
    }
    return el.reduce((s, l) => s.plus(l.given), sale_return_money_1.ZERO).gt(0) ? 'DELIVERED' : 'RETURNED';
}
function notTakenRowsOf(items, money, unitNames) {
    return items.map((item, i) => {
        const m = money.lines[i];
        const typedRaw = item.sriUndeliveredQty;
        const typed = typedRaw === undefined || typedRaw === null || typedRaw === '' ? null : (0, sale_return_money_1.D)(typedRaw);
        const qty = m ? m.qty : (0, sale_return_money_1.D)(item.sriReturnQty).plus((0, sale_return_money_1.D)(item.sriFreeQty));
        return {
            index: i,
            lineNo: item.sriLineNo ?? i + 1,
            sriId: item.sriId ?? null,
            billItemId: m?.billItemId ?? item.sriBillItemId ?? null,
            billAccYear: (m?.billAccYear ?? item.sriBillAccYear ?? null)?.trim() ?? null,
            godownId: item.sriGodownId ?? null,
            lotId: item.sriLotId ?? null,
            condition: item.sriCondition ?? null,
            qty,
            factor: m && m.factor.gt(0) ? m.factor : (0, sale_return_money_1.D)(item.sriToBaseFactor || 1),
            typed,
            unitName: unitNames.get(item.sriItemUnitId) ?? null,
        };
    });
}
async function loadNotTakenLines(tx, pending, rows, srId) {
    const keys = new Map();
    for (const r of rows) {
        if (r.billItemId && r.billAccYear) {
            keys.set(lineKey(r.billItemId, r.billAccYear), {
                billItemId: r.billItemId,
                billAccYear: r.billAccYear,
            });
        }
    }
    const out = new Map();
    if (keys.size === 0) {
        return out;
    }
    const facts = await pending.linesByKeys(tx, [...keys.values()]);
    const eligible = facts.filter((f) => f.eligible);
    if (facts.length === 0) {
        return out;
    }
    const ids = facts.map((f) => f.billItemId);
    const own = new Map();
    const taken = new Map();
    const names = new Map();
    if (eligible.length > 0) {
        const eligibleIds = eligible.map((f) => f.billItemId);
        if (srId) {
            const ownRows = await tx.$queryRaw `
        SELECT sde_bill_item_id AS id, SUM(sde_settle_base_qty) AS base
          FROM sales.sale_delivery_event
         WHERE sde_src_doc_type = 'SALE_RETURN' AND sde_src_doc_id = ${srId}::uuid
           AND sde_bill_item_id = ANY(${eligibleIds}::uuid[])
           AND sde_is_deleted = false
         GROUP BY sde_bill_item_id`;
            for (const o of ownRows) {
                own.set(o.id, (0, sale_return_money_1.D)(o.base ?? 0));
            }
        }
        const takenRows = await tx.$queryRaw `
      SELECT sri.sri_bill_item_id AS id,
             SUM((COALESCE(sri.sri_return_qty, 0) + COALESCE(sri.sri_free_qty, 0) - sri.sri_undelivered_qty)
                 * CASE WHEN sri.sri_to_base_factor > 0 THEN sri.sri_to_base_factor
                        ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END) AS base
        FROM sales.sale_return_item sri
        JOIN sales.sale_return sr ON sr.sr_id = sri.sri_return_id AND sr.sr_acc_year = sri.sri_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = sri.sri_item_unit_id
       WHERE sri.sri_bill_item_id = ANY(${eligibleIds}::uuid[])
         AND sri.sri_is_deleted = false
         AND sr.sr_is_deleted = false
         AND sr.sr_status = 'POSTED'
         AND sr.sr_id <> ${srId ?? '00000000-0000-0000-0000-000000000000'}::uuid
       GROUP BY sri.sri_bill_item_id`;
        for (const t of takenRows) {
            taken.set(t.id, (0, sale_return_money_1.D)(t.base ?? 0));
        }
    }
    const nameRows = await tx.$queryRaw `
    SELECT i.sbi_id AS id, um.unit_name, gd.gdl_name AS godown_name, lt.slt_batch_no AS lot_no
      FROM sales.sale_bill_item i
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
      LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = i.sbi_godown_id
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = i.sbi_lot_id
     WHERE i.sbi_id = ANY(${ids}::uuid[])`;
    for (const r of nameRows) {
        names.set(r.id, { unit: r.unit_name, godown: r.godown_name, lot: r.lot_no });
    }
    for (const f of facts) {
        const nm = names.get(f.billItemId);
        out.set(lineKey(f.billItemId, f.billAccYear), {
            billItemId: f.billItemId,
            billAccYear: f.billAccYear,
            billId: f.billId,
            billRefno: f.billRefno,
            lineNo: f.lineNo,
            itemId: f.itemId,
            eligible: f.eligible,
            godownId: f.godownId,
            lotId: f.lotId,
            factor: f.factor,
            pendingBase: f.eligible ? f.pendingBase.plus(own.get(f.billItemId) ?? sale_return_money_1.ZERO) : sale_return_money_1.ZERO,
            givenBase: f.givenBase,
            takenBeforeBase: taken.get(f.billItemId) ?? sale_return_money_1.ZERO,
            unitName: nm?.unit ?? null,
            godownName: nm?.godown ?? null,
            lotNo: nm?.lot ?? null,
        });
    }
    return out;
}
async function returnEventsOf(tx, srId) {
    const rows = await tx.$queryRaw `
    SELECT e.sde_id, e.sde_acc_year, e.sde_src_line_id, e.sde_settle_qty, e.sde_settle_base_qty,
           e.sde_bill_item_id, e.sde_bill_acc_year, e.sde_bill_id,
           EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                    WHERE x.sde_reverses_id = e.sde_id AND x.sde_kind = 'RETURN_CANCEL') AS reversed
      FROM sales.sale_delivery_event e
     WHERE e.sde_src_doc_type = 'SALE_RETURN' AND e.sde_src_doc_id = ${srId}::uuid
       AND e.sde_kind = 'RETURN' AND e.sde_is_deleted = false`;
    const live = new Map();
    const ever = new Set();
    for (const r of rows) {
        if (!r.sde_src_line_id) {
            continue;
        }
        ever.add(r.sde_src_line_id);
        if (!r.reversed) {
            live.set(r.sde_src_line_id, {
                sdeId: r.sde_id,
                accYear: r.sde_acc_year.trim(),
                settleQty: (0, sale_return_money_1.D)(r.sde_settle_qty),
                settleBase: (0, sale_return_money_1.D)(r.sde_settle_base_qty),
                billItemId: r.sde_bill_item_id,
                billAccYear: r.sde_bill_acc_year.trim(),
                billId: r.sde_bill_id,
            });
        }
    }
    return { live, ever };
}
function amendLockIssues(rows, verdict, events) {
    const issues = [];
    rows.forEach((r, i) => {
        if (!r.sriId || !events.ever.has(r.sriId)) {
            return;
        }
        const nowBase = (0, sale_return_money_1.r6)(verdict.rows[i]?.resolvedBase ?? sale_return_money_1.ZERO);
        const live = events.live.get(r.sriId);
        const ok = live ? nowBase.isZero() || nowBase.equals((0, sale_return_money_1.r6)(live.settleBase)) : nowBase.isZero();
        if (!ok) {
            const was = live ? live.settleBase.dividedBy(r.factor.gt(0) ? r.factor : (0, sale_return_money_1.D)(1)) : sale_return_money_1.ZERO;
            issues.push({
                code: exports.DELIVERY_RETURN_CODES_ADDED.DELIVERY_RETURN_AMEND_LOCKED,
                message: `Line ${r.lineNo}: ${fmt(was)} ${r.unitName ?? ''} not taken was posted with this return; an amend may keep it or set it to 0, not change it. Cancel the return and make a new one`,
                field: 'sriUndeliveredQty',
                line: r.lineNo,
                params: { n: r.lineNo, was: fmt(was), unit: r.unitName ?? '' },
            });
        }
    });
    return issues;
}
exports.num = sale_return_money_1.n;
async function unitNamesOf(tx, iucIds) {
    const ids = [...new Set(iucIds.filter((x) => typeof x === 'string' && x !== ''))];
    if (ids.length === 0) {
        return new Map();
    }
    const rows = await tx.$queryRaw `
    SELECT u.iuc_id AS id, um.unit_name AS name
      FROM inventory.item_unit_conversion u
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     WHERE u.iuc_id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((r) => [r.id, r.name ?? '']));
}
//# sourceMappingURL=sale-return-delivery.js.map