"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeliveryNote = checkDeliveryNote;
exports.noteTotals = noteTotals;
exports.noteLoad = noteLoad;
exports.firstRefusal = firstRefusal;
exports.duplicateLineIds = duplicateLineIds;
exports.yearChangedNote = yearChangedNote;
exports.undoBelowReturned = undoBelowReturned;
const client_1 = require("@prisma/client");
const delivery_constants_1 = require("./core/delivery.constants");
const delivery_weight_1 = require("./core/delivery-weight");
const delivery_errors_1 = require("./delivery.errors");
const Z = new client_1.Prisma.Decimal(0);
const q3 = (d) => d.toDecimalPlaces(3).toString();
const positive = (l) => !!l.qty && l.qty.greaterThan(0);
function checkDeliveryNote(header, lines, ctx) {
    const out = [];
    const atPost = ctx.phase !== 'save';
    if (header.godownState === 'MISSING') {
        out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_REQUIRED, 'REFUSE', 'sdnGodownId', 'Pick the godown the goods leave from'));
    }
    else if (header.godownState === 'OTHER_BRANCH') {
        out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_NOT_IN_BRANCH, 'REFUSE', 'sdnGodownId', `${header.godownName} is not a live godown of ${header.branchName}`, { godown: header.godownName, branch: header.branchName }));
    }
    if (header.godownLocked) {
        out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_LOCKED, 'REFUSE', 'sdnGodownId', `The note already has lines from ${header.storedGodownName}; take the lines off first`, { godown: header.storedGodownName }));
    }
    if (atPost) {
        if (header.mode === 'VEHICLE' && !header.vehicleId && !header.vehicleNo?.trim()) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_VEHICLE_REQUIRED, 'REFUSE', 'sdnVehicleId', 'Mode is Vehicle: the vehicle is missing'));
        }
        if (header.mode === 'TRANSPORTER' && !header.transporterId && !header.transporterName?.trim()) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_TRANSPORTER_REQUIRED, 'REFUSE', 'transport.transporterId', 'Mode is Transporter: the transporter is missing'));
        }
        if (header.mode === 'SELF' && !header.collectedBy?.trim()) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_COLLECTED_BY_REQUIRED, 'REFUSE', 'sdnCollectedBy', 'Self pickup: who collected the goods is missing'));
        }
    }
    for (const l of lines) {
        const f = l.facts;
        const at = `lines[${l.lineNo - 1}]`;
        const p = { n: l.lineNo, bill: l.names.bill };
        if (!f || f.companyId !== ctx.companyId || f.billId !== l.billId) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_NOT_POSTED, 'REFUSE', `${at}.billItemId`, `Line ${l.lineNo}: no such posted bill line`, p, l.lineNo));
            continue;
        }
        if (f.branchId !== ctx.branchId) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_OTHER_BRANCH, 'REFUSE', `${at}.billId`, `${l.names.bill} belongs to another branch`, { ...p, branch: '' }, l.lineNo));
            continue;
        }
        if (f.billStatus !== 'POSTED' || f.billDeleted || f.lineDeleted) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_NOT_POSTED, 'REFUSE', `${at}.billId`, `${l.names.bill} is not posted, or is cancelled`, p, l.lineNo));
            continue;
        }
        if (f.deliveryMode !== 'PICKUP' && f.deliveryMode !== 'DISPATCH') {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_INSTANT, 'REFUSE', `${at}.billId`, `${l.names.bill} is an Instant bill`, p, l.lineNo));
            continue;
        }
        if (!f.eligible) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_LINE_NOT_GOODS, 'REFUSE', `${at}.billItemId`, `Line ${l.lineNo} of ${l.names.bill} is a service or came from a challan`, { ...p, dc: f.srcDocRefno ?? '' }, l.lineNo));
            continue;
        }
        if (!l.qty || l.qty.lessThan(0)) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_QTY_NEGATIVE, 'REFUSE', `${at}.qty`, `Line ${l.lineNo}: Give now cannot be below 0`, { n: l.lineNo }, l.lineNo));
        }
        if (l.bodyGodownId && header.godownId && l.bodyGodownId !== header.godownId) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_LOCKED, 'REFUSE', `${at}.godownId`, `Line ${l.lineNo}: a note gives from its own godown (${header.godownName}) only`, { godown: header.godownName, n: l.lineNo }, l.lineNo));
        }
    }
    if (atPost && !lines.some(positive)) {
        out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_NO_LINES, 'REFUSE', 'lines', 'Every Give now is blank'));
    }
    const good = lines.filter((l) => l.facts &&
        l.facts.eligible &&
        l.facts.branchId === ctx.branchId &&
        l.facts.companyId === ctx.companyId &&
        l.qty &&
        !l.qty.lessThan(0));
    if (atPost) {
        const sumByLine = new Map();
        for (const l of good) {
            const k = l.billItemId;
            sumByLine.set(k, (sumByLine.get(k) ?? Z).plus(l.qty));
        }
        const reported = new Set();
        for (const l of good) {
            const total = sumByLine.get(l.billItemId);
            const pending = l.facts.pendingQty;
            if (total.greaterThan(pending) && l.qty.greaterThan(0) && !reported.has(l.billItemId)) {
                reported.add(l.billItemId);
                out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_QTY_OVER_PENDING, 'REFUSE', `lines[${l.lineNo - 1}].qty`, `Line ${l.lineNo}: ${q3(total)} ${l.names.unit} typed, but only ${q3(pending)} are left to give on ${l.names.bill}`, {
                    n: l.lineNo,
                    qty: q3(total),
                    unit: l.names.unit,
                    pending: q3(pending.greaterThan(0) ? pending : Z),
                    bill: l.names.bill,
                }, l.lineNo));
            }
        }
    }
    for (const l of good) {
        if (!header.godownId || l.facts.godownId === header.godownId) {
            continue;
        }
        if (!ctx.canOverride) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_RIGHT, 'REFUSE', `lines[${l.lineNo - 1}].godownId`, `Line ${l.lineNo} was billed from ${l.names.billGodown}; giving it from ${header.godownName} needs the Override right`, { n: l.lineNo, billGodown: l.names.billGodown }, l.lineNo));
        }
        else if (l.qty.greaterThan(0) && ctx.phase !== 'save') {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_OTHER_GODOWN, 'WARN', `lines[${l.lineNo - 1}].godownId`, `Line ${l.lineNo}: billed from ${l.names.billGodown}, given from ${header.godownName}; post moves ${q3(l.qty)} ${l.names.unit} on the books`, {
                n: l.lineNo,
                qty: q3(l.qty),
                unit: l.names.unit,
                billGodown: l.names.billGodown,
                godown: header.godownName,
            }, l.lineNo));
        }
    }
    for (const l of good) {
        if (l.lotId && !l.lotKnown) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_LOT_INVALID, 'REFUSE', `lines[${l.lineNo - 1}].lotId`, `${l.names.lot} is not a lot of ${l.names.item} in ${header.godownName}`, { lot: l.names.lot, item: l.names.item, godown: header.godownName, n: l.lineNo }, l.lineNo));
        }
        else if (ctx.phase !== 'save' &&
            l.qty.greaterThan(0) &&
            l.lotId &&
            l.facts.lotId &&
            l.lotId !== l.facts.lotId) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_LOT_SWAP, 'INFO', `lines[${l.lineNo - 1}].lotId`, `Line ${l.lineNo}: lot ${l.names.lot} given for ${l.names.billLot}; post swaps ${q3(l.qty)} ${l.names.unit} between the lots on the books`, { n: l.lineNo, given: l.names.lot, billLot: l.names.billLot, qty: q3(l.qty), unit: l.names.unit }, l.lineNo));
        }
    }
    if (ctx.phase === 'save') {
        return out;
    }
    const drawn = new Map();
    for (const l of good) {
        const f = l.facts;
        const key = `${f.itemId}|${l.lotId ?? ''}|${f.bucket}`;
        const base = l.qty.times(f.factor);
        if (l.qty.isZero()) {
            if (l.shelfBase.lessThan(f.pendingBase) && f.pendingQty.greaterThan(0)) {
                out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_SHELF_SHORT, 'INFO', `lines[${l.lineNo - 1}].qty`, `Line ${l.lineNo}: only ${q3(shelfInUnit(l))} ${l.names.unit} of ${l.names.item} on the shelf here; ${q3(f.pendingQty)} are billed`, {
                    n: l.lineNo,
                    shelf: q3(shelfInUnit(l)),
                    unit: l.names.unit,
                    item: l.names.item,
                    pending: q3(f.pendingQty),
                }, l.lineNo));
            }
            continue;
        }
        const sum = (drawn.get(key) ?? Z).plus(base);
        drawn.set(key, sum);
        if (sum.greaterThan(l.shelfBase)) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_OVER_SHELF, 'WARN', `lines[${l.lineNo - 1}].qty`, `Line ${l.lineNo}: the books say ${q3(shelfInUnit(l))} ${l.names.unit} of lot ${l.names.lot} are on the shelf here; ${q3(l.qty)} are being given`, { n: l.lineNo, shelf: q3(shelfInUnit(l)), unit: l.names.unit, lot: l.names.lot, qty: q3(l.qty) }, l.lineNo));
        }
    }
    const weight = weightOf(good);
    if (header.mode === 'VEHICLE' && header.capacityKg && header.capacityKg.greaterThan(0)) {
        if (weight.greaterThan(header.capacityKg)) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_VEHICLE_OVERLOAD, 'WARN', 'sdnVehicleId', `${q3(weight)} kg on ${header.vehicleLabel}, over its ${q3(header.capacityKg)} kg`, { kg: q3(weight), vehicle: header.vehicleLabel, cap: q3(header.capacityKg) }));
        }
    }
    if (header.frozen) {
        out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_FROZEN, 'REFUSE', 'sdnGodownId', `${header.godownName} is frozen for a count from ${header.frozen.from} to ${header.frozen.to}`, { godown: header.godownName, from: header.frozen.from, to: header.frozen.to }));
    }
    if (ctx.phase === 'post') {
        const ticked = new Set(ctx.overrideWarnings.map((c) => c.trim().toUpperCase()));
        const open = [...new Set(out.filter((n) => n.severity === 'WARN').map((n) => n.code))].filter((c) => !ticked.has(c));
        if (open.length > 0) {
            out.push((0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_WARN_NOT_CONFIRMED, 'REFUSE', 'overrideWarnings', `${open.length} warning(s) need your tick before posting: ${open.join(', ')}`, { count: open.length, codes: open.join(', ') }));
        }
    }
    return out;
}
function shelfInUnit(l) {
    const f = l.facts;
    return f.factor.isZero() ? l.shelfBase : l.shelfBase.dividedBy(f.factor);
}
function weightOf(lines) {
    return lines.reduce((a, l) => a.plus((0, delivery_weight_1.lineWeightKg)(l.qty, l.facts.unitKg)), Z);
}
function noteTotals(lines) {
    const given = lines.filter((l) => positive(l) && l.facts);
    const qty = given.reduce((a, l) => a.plus(l.qty), Z);
    const bags = given
        .filter((l) => /^bag/i.test(l.names.unit.trim()))
        .reduce((a, l) => a.plus(l.qty), Z);
    return {
        lines: given.length,
        qty: q3(qty),
        bags: q3(bags),
        weightKg: q3(weightOf(given)),
        bills: new Set(given.map((l) => `${l.billId}|${l.billAccYear}`)).size,
    };
}
function noteLoad(header, totals) {
    const weight = new client_1.Prisma.Decimal(totals.weightKg);
    const cap = header.capacityKg && header.capacityKg.greaterThan(0) ? header.capacityKg : null;
    return {
        capacityKg: cap ? q3(cap) : null,
        weightKg: q3(weight),
        percent: cap ? Number(weight.dividedBy(cap).times(100).toDecimalPlaces(1).toString()) : null,
        spareKg: cap ? q3(cap.minus(weight)) : null,
    };
}
function firstRefusal(notes) {
    return notes.find((n) => n.severity === 'REFUSE') ?? null;
}
function duplicateLineIds(lines) {
    const seen = new Map();
    for (const [idx, l] of lines.entries()) {
        if (!l.sdniId) {
            continue;
        }
        const first = seen.get(l.sdniId);
        if (first !== undefined) {
            return (0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_LINE_DUPLICATE, 'REFUSE', `lines[${idx}].sdniId`, `Line ${idx + 1} repeats line ${first + 1} (sdniId ${l.sdniId}): each note line is sent once`, { n: idx + 1, first: first + 1 }, idx + 1);
        }
        seen.set(l.sdniId, idx);
    }
    return null;
}
function yearChangedNote(noteYear, yearNow, refno, draft) {
    if (noteYear.trim() === yearNow.trim()) {
        return null;
    }
    return (0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_DRAFT_YEAR_CHANGED, 'REFUSE', draft ? 'sdnId' : 'accYear', draft
        ? `Draft ${refno ?? ''} was saved in ${noteYear.trim()}, but today falls in ${yearNow}: make the note again in ${yearNow}`
        : `This note would be filed in ${noteYear.trim()}, but today falls in ${yearNow}: switch to ${yearNow}`, { refno: refno ?? '', year: noteYear.trim(), yearNow });
}
function undoBelowReturned(lines) {
    for (const l of lines) {
        const taken = l.takenBase.toDecimalPlaces(6);
        if (taken.lte(0)) {
            continue;
        }
        const after = l.givenBase.minus(l.removeBase).toDecimalPlaces(6);
        if (after.greaterThanOrEqualTo(taken)) {
            continue;
        }
        const f = l.factor.greaterThan(0) ? l.factor : new client_1.Prisma.Decimal(1);
        const qty = q3(taken.dividedBy(f));
        const shown = l.returnRefnos.slice(0, 3).join(', ') + (l.returnRefnos.length > 3 ? ', …' : '');
        return (0, delivery_errors_1.note)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_UNDO_BELOW_RETURNED, 'REFUSE', l.field, `Line ${l.billLineNo} of ${l.billRefno}: ${qty} ${l.unitName} came back on sale return ${shown}; cancel or amend that return first`, {
            n: l.billLineNo,
            bill: l.billRefno,
            qty,
            unit: l.unitName,
            sr: shown,
            givenAfter: q3(client_1.Prisma.Decimal.max(Z, after).dividedBy(f)),
        }, l.noteLineNo);
    }
    return null;
}
//# sourceMappingURL=delivery-note.rules.js.map