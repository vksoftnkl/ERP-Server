"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.D0 = void 0;
exports.dec = dec;
exports.qtyIn = qtyIn;
exports.kg = kg;
exports.unitOf = unitOf;
exports.lastGivenOf = lastGivenOf;
exports.buildRows = buildRows;
exports.sortRows = sortRows;
exports.filterRows = filterRows;
exports.tilesOf = tilesOf;
exports.totalsOf = totalsOf;
exports.behindBillRows = behindBillRows;
exports.behindChallanRows = behindChallanRows;
exports.byLotOf = byLotOf;
exports.printedAsOf = printedAsOf;
const client_1 = require("@prisma/client");
exports.D0 = new client_1.Prisma.Decimal(0);
function dec(v) {
    if (v === null || v === undefined || v === '')
        return exports.D0;
    return v instanceof client_1.Prisma.Decimal ? v : new client_1.Prisma.Decimal(v);
}
function qtyIn(base, factor) {
    const f = dec(factor);
    return dec(base)
        .dividedBy(f.isZero() ? 1 : f)
        .toFixed(3);
}
function kg(v) {
    return dec(v).toFixed(3);
}
function unitOf(f, mode) {
    if (mode === 'BASE' || !f) {
        return { name: f?.base_unit ?? '', factor: dec(1) };
    }
    const factor = dec(f.sell_factor);
    return {
        name: f.sell_unit || f.base_unit,
        factor: factor.greaterThan(0) ? factor : dec(1),
    };
}
function sellFactorOf(f) {
    const factor = dec(f?.sell_factor ?? 1);
    return factor.greaterThan(0) ? factor : dec(1);
}
function lastGivenOf(r) {
    if (!r.last_date)
        return null;
    return {
        refno: r.last_refno,
        date: r.last_date,
        sdnId: r.last_doc_id,
        accYear: r.last_doc_year ? r.last_doc_year.trim() : null,
    };
}
function buildRows(input) {
    const facts = new Map(input.facts.map((f) => [f.item_id, f]));
    return input.rows.map((r) => {
        const f = facts.get(r.item_id);
        const unit = unitOf(f, input.qtyIn);
        const owned = dec(r.owned);
        const bnd = dec(r.bnd);
        const physical = owned.plus(bnd);
        const reserved = dec(r.reserved);
        const free = dec(r.free);
        const dc = dec(r.dc_open);
        const short = bnd.minus(physical).greaterThan(0) ? bnd.minus(physical) : exports.D0;
        const kgPerBase = dec(f?.kg_per_base);
        const g = input.godowns.get(r.godown_id);
        const tie = physical.equals(owned.plus(bnd)) && bnd.equals(dec(r.bnd_ev));
        const name = f?.item_name ?? '';
        const wire = {
            itemId: r.item_id,
            itemCode: f?.item_code ?? null,
            itemName: name,
            godownId: r.godown_id,
            godownName: g?.name ?? null,
            unitName: unit.name,
            unitFactor: unit.factor.toFixed(6),
            physical: qtyIn(physical, unit.factor),
            billedNotDelivered: qtyIn(bnd, unit.factor),
            owned: qtyIn(owned, unit.factor),
            reserved: qtyIn(reserved, unit.factor),
            freeToSell: qtyIn(free, unit.factor),
            onVehicle: null,
            challanOut: qtyIn(dc, unit.factor),
            physicalKg: kg(physical.times(kgPerBase)),
            lastGiven: lastGivenOf(r),
            short: qtyIn(short, unit.factor),
            overGiven: qtyIn(dec(r.over_given), unit.factor),
            tie,
        };
        return {
            wire,
            nameKey: name.toLowerCase(),
            godownSort: g?.sort ?? Number.MAX_SAFE_INTEGER,
            godownNameKey: (g?.name ?? '').toLowerCase(),
            findText: [f?.item_code, f?.item_name, f?.barcode].filter(Boolean).join('\u0001').toLowerCase(),
            billIds: r.bill_ids ?? [],
            dcIds: r.dc_ids ?? [],
            num: { owned, bnd, physical, reserved, free, dc, short },
            kgPerBase,
            sellFactor: sellFactorOf(f),
        };
    });
}
function sortRows(rows) {
    return [...rows].sort((a, b) => {
        if (a.nameKey !== b.nameKey)
            return a.nameKey < b.nameKey ? -1 : 1;
        if (a.wire.itemId !== b.wire.itemId)
            return a.wire.itemId < b.wire.itemId ? -1 : 1;
        if (a.godownSort !== b.godownSort)
            return a.godownSort - b.godownSort;
        if (a.godownNameKey !== b.godownNameKey)
            return a.godownNameKey < b.godownNameKey ? -1 : 1;
        return a.wire.godownId < b.wire.godownId ? -1 : a.wire.godownId > b.wire.godownId ? 1 : 0;
    });
}
function filterRows(rows, v) {
    const find = v.find.trim().toLowerCase();
    return rows.filter((r) => {
        const n = r.num;
        if (v.hideZero &&
            n.owned.isZero() &&
            n.bnd.isZero() &&
            n.reserved.isZero() &&
            n.dc.isZero()) {
            return false;
        }
        if (v.onlyToGive && n.bnd.isZero())
            return false;
        if (find && !r.findText.includes(find))
            return false;
        return true;
    });
}
function tilesOf(rows) {
    let physKg = exports.D0;
    let physPk = exports.D0;
    let bndKg = exports.D0;
    let bndPk = exports.D0;
    let ownKg = exports.D0;
    let ownPk = exports.D0;
    let resKg = exports.D0;
    let resPk = exports.D0;
    let dcKg = exports.D0;
    let dcPk = exports.D0;
    const bills = new Set();
    const dcs = new Set();
    const reservedItems = new Set();
    let shortRows = 0;
    let first = null;
    for (const r of rows) {
        const n = r.num;
        physKg = physKg.plus(n.physical.times(r.kgPerBase));
        physPk = physPk.plus(n.physical.dividedBy(r.sellFactor));
        bndKg = bndKg.plus(n.bnd.times(r.kgPerBase));
        bndPk = bndPk.plus(n.bnd.dividedBy(r.sellFactor));
        ownKg = ownKg.plus(n.owned.times(r.kgPerBase));
        ownPk = ownPk.plus(n.owned.dividedBy(r.sellFactor));
        resKg = resKg.plus(n.reserved.times(r.kgPerBase));
        resPk = resPk.plus(n.reserved.dividedBy(r.sellFactor));
        dcKg = dcKg.plus(n.dc.times(r.kgPerBase));
        dcPk = dcPk.plus(n.dc.dividedBy(r.sellFactor));
        r.billIds.forEach((b) => bills.add(b));
        r.dcIds.forEach((d) => dcs.add(d));
        if (!n.reserved.isZero())
            reservedItems.add(r.wire.itemId);
        if (n.short.greaterThan(0)) {
            shortRows += 1;
            if (!first) {
                first = {
                    itemId: r.wire.itemId,
                    itemName: r.wire.itemName,
                    godownId: r.wire.godownId,
                    godownName: r.wire.godownName,
                    unitName: r.wire.unitName,
                    physical: r.wire.physical,
                    billedNotDelivered: r.wire.billedNotDelivered,
                };
            }
        }
    }
    return {
        physical: { kg: kg(physKg), pkgs: physPk.toFixed(3), rows: rows.length },
        billedNotDelivered: { kg: kg(bndKg), pkgs: bndPk.toFixed(3), bills: bills.size },
        owned: { kg: kg(ownKg), pkgs: ownPk.toFixed(3) },
        reserved: { kg: kg(resKg), pkgs: resPk.toFixed(3), items: reservedItems.size },
        short: { items: shortRows, first },
        challanOut: { kg: kg(dcKg), pkgs: dcPk.toFixed(3), challans: dcs.size },
    };
}
function totalsOf(rows) {
    let phys = exports.D0;
    let bnd = exports.D0;
    let own = exports.D0;
    let res = exports.D0;
    let free = exports.D0;
    let dc = exports.D0;
    let tie = true;
    for (const r of rows) {
        phys = phys.plus(r.num.physical.times(r.kgPerBase));
        bnd = bnd.plus(r.num.bnd.times(r.kgPerBase));
        own = own.plus(r.num.owned.times(r.kgPerBase));
        res = res.plus(r.num.reserved.times(r.kgPerBase));
        free = free.plus(r.num.free.times(r.kgPerBase));
        dc = dc.plus(r.num.dc.times(r.kgPerBase));
        tie = tie && r.wire.tie;
    }
    return {
        physicalKg: kg(phys),
        bndKg: kg(bnd),
        ownedKg: kg(own),
        reservedKg: kg(res),
        freeKg: kg(free),
        challanKg: kg(dc),
        rows: rows.length,
        tie,
    };
}
function behindBillRows(rows, factor) {
    return rows.map((r) => {
        const lf = dec(r.factor);
        return {
            billId: r.bill_id,
            billAccYear: r.bill_acc_year.trim(),
            billRefno: r.bill_refno,
            billDate: r.bill_date,
            days: r.days === null ? null : Number(r.days),
            custId: r.cust_id,
            custName: r.cust_name,
            areaName: r.area_name,
            mode: r.mode,
            billItemId: r.line_id,
            lineNo: Number(r.line_no),
            lotId: r.lot_id,
            lotNo: r.lot_no,
            billed: qtyIn(dec(r.billed_qty).times(lf), factor),
            given: qtyIn(dec(r.given_qty).times(lf), factor),
            pending: qtyIn(dec(r.pending_base), factor),
            lastGiven: lastGivenOf(r),
        };
    });
}
function behindChallanRows(rows, factor) {
    return rows.map((r) => ({
        dcId: r.dc_id,
        dcAccYear: r.dc_acc_year.trim(),
        dcRefno: r.dc_refno,
        dcDate: r.dc_date,
        days: r.days === null ? null : Number(r.days),
        custId: r.cust_id,
        custName: r.cust_name,
        open: qtyIn(r.open_base, factor),
        total: qtyIn(r.total_base, factor),
    }));
}
function byLotOf(rows, factor) {
    let own = exports.D0;
    let bnd = exports.D0;
    let res = exports.D0;
    let free = exports.D0;
    const byLot = rows
        .filter((r) => !dec(r.owned).isZero() || !dec(r.bnd).isZero())
        .map((r) => {
        const o = dec(r.owned);
        const b = dec(r.bnd);
        return {
            lotId: r.lot_id,
            lotNo: r.lot_no,
            owned: qtyIn(o, factor),
            notDelivered: qtyIn(b, factor),
            physical: qtyIn(o.plus(b), factor),
        };
    });
    for (const r of rows) {
        own = own.plus(dec(r.owned));
        bnd = bnd.plus(dec(r.bnd));
        res = res.plus(dec(r.reserved));
        free = free.plus(dec(r.free));
    }
    return {
        byLot,
        sum: {
            owned: qtyIn(own, factor),
            billedNotDelivered: qtyIn(bnd, factor),
            physical: qtyIn(own.plus(bnd), factor),
            reserved: qtyIn(res, factor),
            freeToSell: qtyIn(free, factor),
        },
    };
}
const BUCKET_LABEL = {
    SALEABLE: 'saleable',
    DAMAGED: 'damaged',
    QUARANTINE: 'quarantine',
    EXPIRED: 'expired',
    SAMPLE: 'sample',
};
function printedAsOf(p) {
    return [
        p.branchName,
        p.godownName ?? 'All godowns',
        p.groupName ? `Group: ${p.groupName}` : null,
        p.brandName ? `Brand: ${p.brandName}` : null,
        p.qtyIn === 'BASE' ? 'qty in base unit' : 'qty in the selling unit',
        p.bucket === 'ALL' ? 'All buckets' : (BUCKET_LABEL[p.bucket] ?? p.bucket.toLowerCase()),
        p.onlyToGive ? 'only with goods to give' : null,
        p.hideZero ? 'hide zero' : null,
        p.find ? `find "${p.find}"` : null,
        `as of ${p.asOf}`,
    ]
        .filter(Boolean)
        .join(' · ');
}
//# sourceMappingURL=godown-position.rules.js.map