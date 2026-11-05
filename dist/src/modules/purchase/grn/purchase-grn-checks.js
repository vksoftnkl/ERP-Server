"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grnShelfLife = grnShelfLife;
exports.judgeGrnLines = judgeGrnLines;
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
const DAY = 86400000;
async function grnShelfLife(tx, minPctSetting, receipt, facts) {
    const out = new Map();
    const itemIds = [...new Set(facts.filter((f) => f.rows.some((r) => r.expiryDate)).map((f) => f.itemId))];
    if (!itemIds.length)
        return out;
    const items = await tx.$queryRaw `
    SELECT item_id, item_min_shelf_life_pct AS min_pct, item_expiry_days AS days FROM inventory.item_master WHERE item_id = ANY(${itemIds}::uuid[])`;
    const by = new Map(items.map((i) => [i.item_id, i]));
    const rec = new Date(`${receipt.slice(0, 10)}T00:00:00Z`).getTime();
    for (const f of facts) {
        const it = by.get(f.itemId);
        const min = it?.min_pct != null ? Number(it.min_pct) : minPctSetting > 0 ? minPctSetting : null;
        let worst = null, expired = false;
        for (const r of f.rows) {
            if (r.bucket !== 'SALEABLE' || !r.expiryDate)
                continue;
            const exp = r.expiryDate.getTime();
            const left = (exp - rec) / DAY;
            if (left < 0) {
                expired = true;
                worst = 0;
                continue;
            }
            const span = r.mfgDate && r.mfgDate.getTime() < exp ? (exp - r.mfgDate.getTime()) / DAY : (it?.days ?? 0);
            if (!(span > 0))
                continue;
            const pct = Math.max(0, Math.min(100, Math.floor((left / span) * 100)));
            worst = worst == null ? pct : Math.min(worst, pct);
        }
        if (worst != null || expired)
            out.set(f.lineNo, { pct: worst, min, expired });
    }
    return out;
}
function judgeGrnLines(facts, shelf, shelfMode, tracked) {
    const issues = [];
    const checks = new Map();
    for (const f of facts) {
        const name = f.itemName ? ` ${f.itemName}` : '';
        const chips = [];
        const short = f.challan.minus(f.received).minus(f.damaged);
        if (short.greaterThan(0)) {
            chips.push({ code: 'SHORT', text: `SHORT ${short.toString()}` });
            issues.push({ code: 'PUR_SHORT_VS_CHALLAN', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.receivedQty`, needsRight: null,
                message: `Line ${f.lineNo}${name}: the challan says ${f.challan.toString()}, ${f.received.plus(f.damaged).toString()} arrived — ${short.toString()} short goes to the shortage register.` });
        }
        const noReason = f.damaged.greaterThan(0) && !f.damageReasonId;
        if (f.damaged.greaterThan(0))
            chips.push({ code: 'DAMAGED', text: `${f.damaged.toString()} DAMAGED` });
        if (noReason) {
            issues.push({ code: 'PUR_GRN_DAMAGE_NO_REASON', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.damageReasonId`, needsRight: null,
                message: `Line ${f.lineNo}${name}: ${f.damaged.toString()} damaged with no reason — pick one (Stock Reasons).` });
        }
        if (f.excess.greaterThan(0))
            chips.push({ code: 'EXCESS', text: `EXCESS ${f.excess.toString()}` });
        const sl = shelf.get(f.lineNo);
        if (sl && (sl.expired || (sl.pct != null && sl.min != null && sl.pct < sl.min))) {
            chips.push({ code: 'SHELF_LIFE', text: 'SHELF LIFE' });
            if (shelfMode !== 'OFF') {
                const refuse = shelfMode === 'REFUSE';
                issues.push({ code: 'PUR_SHELF_LIFE', level: refuse ? 'REFUSE' : 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.allocs`, needsRight: refuse ? 'OVERRIDE' : null,
                    message: sl.expired ? `Line ${f.lineNo}${name}: the goods have already expired.`
                        : `Line ${f.lineNo}${name}: ${sl.pct} % of its shelf life left — the minimum is ${sl.min} %.` });
            }
        }
        let serials = null;
        if (tracked.has(f.itemId)) {
            const pieces = f.rows.filter((r) => r.bucket === 'SALEABLE' || r.bucket === 'DAMAGED').reduce((s, r) => s.plus(r.qty), purchase_doc_helpers_1.ZERO);
            const have = f.rows.filter((r) => r.serialNo?.trim()).length;
            serials = { have, need: pieces.toString() };
            chips.push({ code: 'SERIALS', text: `${have}/${pieces.toString()} SN` });
            if (!(0, purchase_doc_helpers_1.D)(have).equals(pieces)) {
                issues.push({ code: 'PUR_SERIAL_COUNT', level: 'REFUSE', lineNo: f.lineNo, field: `lines.${f.index}.allocs`, needsRight: null,
                    message: `Line ${f.lineNo}${name}: ${have} serial${have === 1 ? '' : 's'} for ${pieces.toString()} received — scan every piece (F12).` });
            }
        }
        if (!chips.some((c) => c.code !== 'SERIALS') && (!serials || (0, purchase_doc_helpers_1.D)(serials.have).equals((0, purchase_doc_helpers_1.D)(serials.need))))
            chips.unshift({ code: 'OK', text: 'OK' });
        const labels = f.rows.filter((r) => r.bucket === 'SALEABLE').reduce((s, r) => s.plus(r.qty), purchase_doc_helpers_1.ZERO);
        checks.set(f.lineNo, {
            shortQty: (short.isNegative() ? purchase_doc_helpers_1.ZERO : short).toString(), damagedQty: f.damaged.toString(), damageReasonMissing: noReason,
            excessQty: f.excess.toString(), excessAction: f.excessAction, shelfLifePct: sl?.pct ?? null, minShelfLifePct: sl?.min ?? null,
            labels: Math.ceil(Number(labels)), serials, chips,
        });
    }
    return { issues, checks };
}
//# sourceMappingURL=purchase-grn-checks.js.map