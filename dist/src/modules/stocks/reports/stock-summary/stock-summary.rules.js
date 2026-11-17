"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPIRY_RED_DAYS = exports.ITEM_CAP = exports.EXPORT_ROW_CAP = exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.DEFAULT_NO_SALE_DAYS = exports.NO_KEY = exports.EXPORT_TABS = exports.GROUP_BY = exports.SHOW_CHOICES = exports.SORT_KEYS = exports.QTY_IN = exports.SUMMARY_BUCKET_CHOICES = exports.SUMMARY_BUCKETS = exports.D0 = void 0;
exports.dec = dec;
exports.qty = qty;
exports.money = money;
exports.rateText = rateText;
exports.daysBetween = daysBetween;
exports.istInstant = istInstant;
exports.monthStart = monthStart;
exports.mergePass = mergePass;
exports.holdingInScope = holdingInScope;
exports.isNonSaleable = isNonSaleable;
exports.unitOf = unitOf;
exports.buildItemRows = buildItemRows;
exports.sumValues = sumValues;
exports.tilesOf = tilesOf;
exports.tieOfRun = tieOfRun;
exports.viewOf = viewOf;
exports.viewEcho = viewEcho;
exports.sortRows = sortRows;
exports.itemSortValue = itemSortValue;
exports.filterItemRows = filterItemRows;
exports.itemView = itemView;
exports.pageOf = pageOf;
exports.drillText = drillText;
exports.groupRows = groupRows;
exports.godownColumns = godownColumns;
exports.godownRow = godownRow;
exports.godownTotals = godownTotals;
exports.buildBranchRows = buildBranchRows;
exports.branchView = branchView;
exports.branchTotals = branchTotals;
exports.printedAsOf = printedAsOf;
exports.chipsText = chipsText;
const client_1 = require("@prisma/client");
const item_ledger_rules_1 = require("../item-ledger/item-ledger.rules");
exports.D0 = new client_1.Prisma.Decimal(0);
function dec(v) {
    return new client_1.Prisma.Decimal(v ?? 0);
}
exports.SUMMARY_BUCKETS = ['SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE'];
exports.SUMMARY_BUCKET_CHOICES = [...exports.SUMMARY_BUCKETS, 'ALL'];
exports.QTY_IN = ['BASE', 'DEFAULT'];
exports.SORT_KEYS = [
    'name',
    'code',
    'group',
    'brand',
    'opening',
    'inward',
    'outward',
    'closing',
    'reserved',
    'available',
    'inTransit',
    'rate',
    'value',
    'lastSale',
    'notDelivered',
    'physical',
];
exports.SHOW_CHOICES = [
    'ALL',
    'NEGATIVE',
    'NON_SALEABLE',
    'IN_TRANSIT',
    'RESERVED',
    'NO_SALE',
    'NOT_TIED',
];
exports.GROUP_BY = ['GROUP', 'BRAND', 'SECTION', 'CATEGORY'];
exports.EXPORT_TABS = ['ITEMS', 'GROUPS', 'GODOWNS', 'BRANCHES'];
exports.NO_KEY = 'NONE';
exports.DEFAULT_NO_SALE_DAYS = 60;
exports.DEFAULT_LIMIT = 500;
exports.MAX_LIMIT = 5_000;
exports.EXPORT_ROW_CAP = 20_000;
exports.ITEM_CAP = 50_000;
exports.EXPIRY_RED_DAYS = 3;
function qty(base, factor) {
    return dec(base).dividedBy(factor).toFixed(3);
}
function money(v) {
    return dec(v).toFixed(2);
}
function rateText(value, baseQty, factor) {
    const q = dec(baseQty);
    if (q.isZero())
        return '0.00';
    return dec(value).dividedBy(q).times(factor).toFixed(2);
}
function daysBetween(a, b) {
    const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
    return Math.round(ms / 86_400_000);
}
function istInstant(ms) {
    return `${new Date(ms + 330 * 60_000).toISOString().slice(0, 19)}+05:30`;
}
function monthStart(iso) {
    return `${iso.slice(0, 7)}-01`;
}
function mergePass(parts) {
    const key = (r) => `${r.item}|${r.lot}|${r.godown}|${r.bucket}`;
    const open = new Map();
    const close = new Map();
    for (const r of parts) {
        if (r.part === 'O')
            open.set(key(r), dec(r.value));
        else if (r.part === 'C')
            close.set(key(r), { value: dec(r.value), vm: r.vm });
    }
    const out = [];
    for (const r of parts) {
        if (r.part !== 'H')
            continue;
        const k = key(r);
        const c = close.get(k);
        out.push({
            item: r.item,
            lot: r.lot,
            godown: r.godown,
            bucket: r.bucket,
            oq: dec(r.oq),
            pq: dec(r.pq),
            iq: dec(r.iq),
            xq: dec(r.xq),
            iv: dec(r.iv),
            xv: dec(r.xv),
            n: Number(r.n ?? 0),
            ov_engine: open.get(k) ?? exports.D0,
            cv_engine: c?.value ?? exports.D0,
            vm: c?.vm ?? 'WAVG',
        });
    }
    return out;
}
function holdingInScope(h, s) {
    return (!s.godownId || h.godown === s.godownId) && (!s.bucket || h.bucket === s.bucket);
}
function isNonSaleable(h, s) {
    return ((!s.godownId || h.godown === s.godownId) &&
        h.bucket !== 'SALEABLE' &&
        !!s.bucket &&
        h.bucket !== s.bucket);
}
function newAcc() {
    return {
        opening: exports.D0,
        closing: exports.D0,
        inward: exports.D0,
        outward: exports.D0,
        openingValue: exports.D0,
        value: exports.D0,
        inwardValue: exports.D0,
        outwardValue: exports.D0,
        nonSaleable: exports.D0,
        nonSaleableByBucket: new Map(),
        godowns: new Map(),
        vm: 'WAVG',
        bnd: exports.D0,
        bndByGodown: new Map(),
    };
}
function unitOf(f, qtyIn) {
    const factor = f?.default_factor ? dec(f.default_factor) : exports.D0;
    if (qtyIn === 'DEFAULT' && f?.default_iuc_id && factor.greaterThan(0)) {
        return {
            unit: {
                name: f.default_unit ?? '',
                factor: factor.toFixed(6),
                isBase: f.default_is_base === true || factor.equals(1),
            },
            factor,
        };
    }
    return {
        unit: { name: f?.base_unit ?? '', factor: dec(1).toFixed(6), isBase: true },
        factor: dec(1),
    };
}
function buildItemRows(input) {
    const s = input.scope;
    const acc = new Map();
    for (const h of input.pass) {
        let a = acc.get(h.item);
        if (!a) {
            a = newAcc();
            acc.set(h.item, a);
        }
        a.vm = h.vm ?? a.vm;
        const cq = dec(h.oq).plus(h.pq);
        if (holdingInScope(h, s)) {
            a.opening = a.opening.plus(h.oq);
            a.closing = a.closing.plus(cq);
            a.inward = a.inward.plus(h.iq);
            a.outward = a.outward.plus(h.xq);
            a.openingValue = a.openingValue.plus(h.ov_engine);
            a.value = a.value.plus(h.cv_engine);
            a.inwardValue = a.inwardValue.plus(h.iv);
            a.outwardValue = a.outwardValue.plus(h.xv);
        }
        if (isNonSaleable(h, s) && (!cq.isZero() || !dec(h.cv_engine).isZero())) {
            a.nonSaleable = a.nonSaleable.plus(h.cv_engine);
            a.nonSaleableByBucket.set(h.bucket, (a.nonSaleableByBucket.get(h.bucket) ?? exports.D0).plus(h.cv_engine));
        }
        if (!s.bucket || h.bucket === s.bucket) {
            const g = a.godowns.get(h.godown) ?? { qty: exports.D0, value: exports.D0 };
            a.godowns.set(h.godown, { qty: g.qty.plus(cq), value: g.value.plus(h.cv_engine) });
        }
    }
    const now = new Map();
    for (const b of input.balance) {
        let n = now.get(b.item);
        if (!n) {
            n = { onHand: exports.D0, reserved: exports.D0, available: exports.D0, value: exports.D0, reservedValue: exports.D0, expiry: null };
            now.set(b.item, n);
        }
        if (holdingInScope(b, s)) {
            n.onHand = n.onHand.plus(b.on_hand);
            n.reserved = n.reserved.plus(b.reserved);
            n.available = n.available.plus(b.available);
            n.value = n.value.plus(b.value);
            n.reservedValue = n.reservedValue.plus(dec(b.reserved).times(b.rate).toDecimalPlaces(2));
        }
        if (b.bucket === 'SALEABLE' &&
            (!s.godownId || b.godown === s.godownId) &&
            dec(b.on_hand).greaterThan(0) &&
            b.expiry &&
            (n.expiry === null || b.expiry < n.expiry)) {
            n.expiry = b.expiry;
        }
    }
    const after = new Map();
    for (const r of input.after) {
        if (!holdingInScope(r, s))
            continue;
        const x = after.get(r.item) ?? { q: exports.D0, n: 0 };
        after.set(r.item, { q: x.q.plus(r.q), n: x.n + Number(r.n) });
    }
    const transit = new Map();
    for (const t of input.transitIn) {
        if (s.godownId && t.to_godown && t.to_godown !== s.godownId)
            continue;
        if (s.godownId && !t.to_godown)
            continue;
        const x = transit.get(t.item) ?? { q: exports.D0, v: exports.D0, from: new Set() };
        x.q = x.q.plus(t.q);
        x.v = x.v.plus(t.v);
        if (t.from_branch_name)
            x.from.add(t.from_branch_name);
        transit.set(t.item, x);
    }
    for (const item of transit.keys()) {
        if (!acc.has(item))
            acc.set(item, newAcc());
    }
    if (s.todayOnly) {
        for (const b of input.bnd ?? []) {
            const q = dec(b.bnd);
            if (q.isZero())
                continue;
            let a = acc.get(b.item);
            if (!a) {
                a = newAcc();
                acc.set(b.item, a);
            }
            if (holdingInScope(b, s))
                a.bnd = a.bnd.plus(q);
            if (!s.bucket || b.bucket === s.bucket) {
                a.bndByGodown.set(b.godown, (a.bndByGodown.get(b.godown) ?? exports.D0).plus(q));
            }
        }
    }
    const facts = new Map(input.facts.map((f) => [f.item_id, f]));
    const rows = [];
    for (const [itemId, a] of acc) {
        const f = facts.get(itemId);
        const { unit, factor } = unitOf(f, s.qtyIn);
        const n = s.todayOnly ? (now.get(itemId) ?? null) : null;
        const tr = s.todayOnly ? (transit.get(itemId) ?? null) : null;
        const af = after.get(itemId) ?? { q: exports.D0, n: 0 };
        const reserved = s.todayOnly ? (n?.reserved ?? exports.D0) : null;
        const available = s.todayOnly ? (n?.available ?? exports.D0) : null;
        const inTransit = s.todayOnly ? (tr?.q ?? exports.D0) : null;
        const notDelivered = s.todayOnly ? a.bnd : null;
        const physical = notDelivered === null ? null : a.closing.plus(notDelivered);
        const costAdj = a.value.minus(a.openingValue.plus(a.inwardValue).minus(a.outwardValue));
        const lastSale = input.lastSale.get(itemId) ?? null;
        const otherCompany = !!f?.company_id && f.company_id !== s.companyId;
        let tie = null;
        if (s.todayOnly) {
            const stockNowQty = n?.onHand ?? exports.D0;
            const stockNowValue = n?.value ?? exports.D0;
            const qtyEqual = a.closing.plus(af.q).equals(stockNowQty);
            const valueEqual = af.n === 0 ? a.value.equals(stockNowValue) : null;
            tie = {
                equal: qtyEqual && valueEqual !== false,
                qtyEqual,
                valueEqual,
                stockNowQty: qty(stockNowQty, factor),
                stockNowValue: money(stockNowValue),
            };
        }
        const chips = [];
        if (a.closing.lessThan(0))
            chips.push({ kind: 'NEGATIVE' });
        const warn = Number(f?.warn_days ?? 0);
        if (s.todayOnly && n?.expiry && warn > 0) {
            const days = daysBetween(s.today, n.expiry);
            if (days <= warn) {
                chips.push({
                    kind: 'EXPIRY',
                    date: n.expiry,
                    days,
                    tone: days <= exports.EXPIRY_RED_DAYS ? 'RED' : 'AMBER',
                });
            }
        }
        let noSale = false;
        if (a.closing.greaterThan(0)) {
            if (!lastSale) {
                chips.push({ kind: 'NEVER_SOLD' });
                noSale = true;
            }
            else {
                const days = daysBetween(lastSale, s.to);
                if (days >= s.noSaleDays) {
                    chips.push({ kind: 'NO_SALE', days });
                    noSale = true;
                }
            }
        }
        if (otherCompany)
            chips.push({ kind: 'OTHER_COMPANY' });
        if (tie && !tie.equal)
            chips.push({ kind: 'NOT_TIED' });
        const nonSaleableByBucket = [...a.nonSaleableByBucket.entries()]
            .map(([bucket, value]) => ({ bucket, value }))
            .sort((x, y) => x.bucket.localeCompare(y.bucket));
        const wire = {
            itemId,
            code: f?.code ?? null,
            name: f?.name ?? '',
            barcode: f?.barcode ?? null,
            sku: f?.sku ?? null,
            groupId: f?.group_id ?? null,
            groupName: f?.group_name ?? null,
            brandId: f?.brand_id ?? null,
            brandName: f?.brand_name ?? null,
            sectionId: f?.section_id ?? null,
            sectionName: f?.section_name ?? null,
            categoryId: f?.category_id ?? null,
            categoryName: f?.category_name ?? null,
            unit,
            defaultUnitId: f?.default_iuc_id ?? null,
            valuation: a.vm,
            otherCompany,
            opening: qty(a.opening, factor),
            inward: qty(a.inward, factor),
            outward: qty(a.outward, factor),
            closing: qty(a.closing, factor),
            reserved: reserved === null ? null : qty(reserved, factor),
            available: available === null ? null : qty(available, factor),
            inTransit: inTransit === null ? null : qty(inTransit, factor),
            notDelivered: notDelivered === null ? null : qty(notDelivered, factor),
            physical: physical === null ? null : qty(physical, factor),
            rate: rateText(a.value, a.closing, factor),
            value: money(a.value),
            openingValue: money(a.openingValue),
            inwardValue: money(a.inwardValue),
            outwardValue: money(a.outwardValue),
            costAdj: money(costAdj),
            nonSaleableValue: money(a.nonSaleable),
            lastSale,
            chips,
            tie,
        };
        Object.freeze(wire);
        const name = (f?.name ?? '').toLowerCase();
        rows.push(Object.freeze({
            wire,
            itemId,
            nameKey: name,
            codeKey: (f?.code ?? '').toLowerCase(),
            groupNameKey: (f?.group_name ?? '').toLowerCase(),
            brandNameKey: (f?.brand_name ?? '').toLowerCase(),
            findText: [f?.code, f?.name, f?.barcode, f?.sku]
                .filter(Boolean)
                .join('\u0001')
                .toLowerCase(),
            keys: {
                GROUP: f?.group_id ?? null,
                BRAND: f?.brand_id ?? null,
                SECTION: f?.section_id ?? null,
                CATEGORY: f?.category_id ?? null,
            },
            names: {
                GROUP: f?.group_name ?? null,
                BRAND: f?.brand_name ?? null,
                SECTION: f?.section_name ?? null,
                CATEGORY: f?.category_name ?? null,
            },
            factor,
            num: {
                opening: a.opening,
                inward: a.inward,
                outward: a.outward,
                closing: a.closing,
                reserved,
                available,
                inTransit,
                rate: a.closing.isZero() ? exports.D0 : a.value.dividedBy(a.closing).times(factor),
                value: a.value,
                notDelivered,
                physical,
            },
            vals: {
                openingValue: a.openingValue,
                inwardValue: a.inwardValue,
                outwardValue: a.outwardValue,
                costAdj,
                value: a.value,
                nonSaleable: a.nonSaleable,
            },
            lastSale,
            flags: {
                zero: a.opening.isZero() &&
                    a.inward.isZero() &&
                    a.outward.isZero() &&
                    a.closing.isZero() &&
                    (reserved?.isZero() ?? true) &&
                    (inTransit?.isZero() ?? true) &&
                    (notDelivered?.isZero() ?? true),
                negative: a.closing.lessThan(0),
                nonSaleable: nonSaleableByBucket.length > 0,
                inTransit: !!inTransit && !inTransit.isZero(),
                reserved: !!reserved && !reserved.isZero(),
                noSale,
                notTied: !!tie && !tie.equal,
            },
            godowns: godownsOf(a, s.todayOnly),
            nonSaleableByBucket,
            reservedValue: s.todayOnly ? (n?.reservedValue ?? exports.D0) : null,
            inTransitValue: s.todayOnly ? (tr?.v ?? exports.D0) : null,
            inTransitFrom: tr ? [...tr.from] : [],
        }));
    }
    return rows;
}
function godownsOf(a, todayOnly) {
    const ids = new Set([...a.godowns.keys(), ...a.bndByGodown.keys()]);
    return [...ids].map((godownId) => {
        const g = a.godowns.get(godownId) ?? { qty: exports.D0, value: exports.D0 };
        return {
            godownId,
            qty: g.qty,
            value: g.value,
            bnd: todayOnly ? (a.bndByGodown.get(godownId) ?? exports.D0) : null,
        };
    });
}
function sumValues(rows) {
    let o = exports.D0;
    let i = exports.D0;
    let x = exports.D0;
    let c = exports.D0;
    let v = exports.D0;
    for (const r of rows) {
        o = o.plus(r.vals.openingValue);
        i = i.plus(r.vals.inwardValue);
        x = x.plus(r.vals.outwardValue);
        c = c.plus(r.vals.costAdj);
        v = v.plus(r.vals.value);
    }
    return {
        openingValue: money(o),
        inwardValue: money(i),
        outwardValue: money(x),
        costAdj: money(c),
        closingValue: money(v),
    };
}
function tilesOf(rows, todayOnly, hideZero) {
    let closing = exports.D0;
    let inStock = 0;
    let hiddenZero = 0;
    let negCount = 0;
    let negValue = exports.D0;
    let first = null;
    let nsValue = exports.D0;
    let nsItems = 0;
    const byBucket = new Map();
    let trValue = exports.D0;
    let trItems = 0;
    const from = new Set();
    let rsValue = exports.D0;
    let rsItems = 0;
    for (const r of rows) {
        closing = closing.plus(r.vals.value);
        if (r.num.closing.greaterThan(0))
            inStock += 1;
        if (r.flags.zero)
            hiddenZero += 1;
        if (r.flags.negative) {
            negCount += 1;
            negValue = negValue.plus(r.vals.value);
            if (!first ||
                r.vals.value.lessThan(first.vals.value) ||
                (r.vals.value.equals(first.vals.value) && r.nameKey < first.nameKey)) {
                first = r;
            }
        }
        if (r.nonSaleableByBucket.length > 0) {
            nsItems += 1;
            nsValue = nsValue.plus(r.vals.nonSaleable);
            for (const b of r.nonSaleableByBucket) {
                const x = byBucket.get(b.bucket) ?? { value: exports.D0, items: 0 };
                byBucket.set(b.bucket, { value: x.value.plus(b.value), items: x.items + 1 });
            }
        }
        if (r.flags.inTransit) {
            trItems += 1;
            trValue = trValue.plus(r.inTransitValue ?? exports.D0);
            r.inTransitFrom.forEach((b) => from.add(b));
        }
        if (r.flags.reserved) {
            rsItems += 1;
            rsValue = rsValue.plus(r.reservedValue ?? exports.D0);
        }
    }
    return {
        closingValue: money(closing),
        items: {
            listed: hideZero ? rows.length - hiddenZero : rows.length,
            inStock,
            hiddenZero,
        },
        negative: {
            count: negCount,
            value: money(negValue),
            first: first
                ? {
                    itemId: first.itemId,
                    name: first.wire.name,
                    closing: first.wire.closing,
                    unit: first.wire.unit.name,
                }
                : null,
        },
        nonSaleable: {
            value: money(nsValue),
            items: nsItems,
            byBucket: [...byBucket.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([bucket, x]) => ({ bucket, value: money(x.value), items: x.items })),
        },
        inTransitIn: todayOnly
            ? { value: money(trValue), items: trItems, fromBranches: [...from].sort() }
            : null,
        reserved: todayOnly ? { value: money(rsValue), items: rsItems } : null,
    };
}
function tieOfRun(rows, todayOnly) {
    if (!todayOnly)
        return { checked: false, items: 0, equal: 0, differ: 0, valueChecked: false };
    let equal = 0;
    let valueChecked = true;
    for (const r of rows) {
        if (r.wire.tie?.equal)
            equal += 1;
        if (r.wire.tie?.valueEqual === null)
            valueChecked = false;
    }
    return { checked: true, items: rows.length, equal, differ: rows.length - equal, valueChecked };
}
function viewOf(q) {
    return {
        sort: (q.sort ?? 'name'),
        dir: q.dir === 'desc' ? 'desc' : 'asc',
        page: q.page ?? 1,
        limit: q.limit ?? exports.DEFAULT_LIMIT,
        hideZero: q.hideZero ?? true,
        onlyNegative: q.onlyNegative ?? false,
        show: (q.show ?? 'ALL'),
        find: (q.find ?? '').trim(),
        groupBy: q.groupBy ?? null,
        groupKey: q.groupBy && q.groupKey !== undefined ? q.groupKey : null,
    };
}
function viewEcho(v) {
    return {
        sort: v.sort,
        dir: v.dir,
        hideZero: v.hideZero,
        onlyNegative: v.onlyNegative,
        show: v.show,
        find: v.find,
        groupBy: v.groupBy,
        groupKey: v.groupKey,
    };
}
function compareValues(a, b) {
    if (a === null && b === null)
        return 0;
    if (a === null)
        return 1;
    if (b === null)
        return -1;
    if (typeof a === 'string' || typeof b === 'string') {
        const x = String(a);
        const y = String(b);
        return x < y ? -1 : x > y ? 1 : 0;
    }
    return a.comparedTo(b);
}
function sortRows(rows, key, dir) {
    const sign = dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        if (ka === null || kb === null) {
            const c = compareValues(ka, kb);
            if (c !== 0)
                return c;
        }
        else {
            const c = compareValues(ka, kb) * sign;
            if (c !== 0)
                return c;
        }
        if (a.nameKey !== b.nameKey)
            return a.nameKey < b.nameKey ? -1 : 1;
        return a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0;
    });
}
function itemSortValue(r, key) {
    switch (key) {
        case 'name':
            return r.nameKey;
        case 'code':
            return r.codeKey;
        case 'group':
            return r.groupNameKey;
        case 'brand':
            return r.brandNameKey;
        case 'lastSale':
            return r.lastSale;
        case 'opening':
        case 'inward':
        case 'outward':
        case 'closing':
        case 'reserved':
        case 'available':
        case 'inTransit':
        case 'rate':
        case 'value':
        case 'notDelivered':
        case 'physical':
            return r.num[key];
        default:
            return r.nameKey;
    }
}
function filterItemRows(rows, v) {
    const find = v.find.toLowerCase();
    const drillKey = v.groupKey === exports.NO_KEY ? null : v.groupKey;
    return rows.filter((r) => {
        const keptNonSaleable = v.show === 'NON_SALEABLE' && r.flags.nonSaleable;
        if (v.hideZero && r.flags.zero && !keptNonSaleable)
            return false;
        if (v.onlyNegative && !r.flags.negative)
            return false;
        switch (v.show) {
            case 'NEGATIVE':
                if (!r.flags.negative)
                    return false;
                break;
            case 'NON_SALEABLE':
                if (!r.flags.nonSaleable)
                    return false;
                break;
            case 'IN_TRANSIT':
                if (!r.flags.inTransit)
                    return false;
                break;
            case 'RESERVED':
                if (!r.flags.reserved)
                    return false;
                break;
            case 'NO_SALE':
                if (!r.flags.noSale)
                    return false;
                break;
            case 'NOT_TIED':
                if (!r.flags.notTied)
                    return false;
                break;
            default:
                break;
        }
        if (v.groupBy && v.groupKey !== null && r.keys[v.groupBy] !== drillKey)
            return false;
        if (find && !r.findText.includes(find))
            return false;
        return true;
    });
}
function itemView(rows, v) {
    return sortRows(filterItemRows(rows, v), (r) => itemSortValue(r, v.sort), v.dir);
}
function pageOf(rows, v) {
    const start = (v.page - 1) * v.limit;
    const slice = rows.slice(start, start + v.limit);
    return {
        slice,
        page: {
            page: v.page,
            limit: v.limit,
            totalRows: rows.length,
            hasMore: start + slice.length < rows.length,
        },
    };
}
const NO_NAME = {
    GROUP: '(No group)',
    BRAND: '(No brand)',
    SECTION: '(No section)',
    CATEGORY: '(No category)',
};
const BY_WORD = {
    GROUP: 'Group',
    BRAND: 'Brand',
    SECTION: 'Section',
    CATEGORY: 'Category',
};
function drillText(rows, by, key) {
    if (!by || key === null)
        return null;
    const k = key === exports.NO_KEY ? null : key;
    const name = k === null ? NO_NAME[by] : (rows.find((r) => r.keys[by] === k)?.names[by] ?? k);
    return `${BY_WORD[by]}: ${name}`;
}
function groupRows(rows, by) {
    const groups = new Map();
    for (const r of rows) {
        const key = r.keys[by];
        const k = key ?? '';
        const g = groups.get(k) ?? { key, name: r.names[by] ?? NO_NAME[by], rows: [] };
        g.rows.push(r);
        groups.set(k, g);
    }
    const total = sumValues(rows);
    const totalValue = dec(total.closingValue);
    const out = [...groups.values()].map((g) => {
        const t = sumValues(g.rows);
        const closing = g.rows.reduce((s, r) => s.plus(r.vals.value), exports.D0);
        return {
            line: {
                key: g.key,
                name: g.name,
                items: g.rows.length,
                ...t,
                share: totalValue.isZero() ? '0.00' : closing.dividedBy(totalValue).times(100).toFixed(2),
            },
            closing,
        };
    });
    out.sort((a, b) => {
        const c = b.closing.comparedTo(a.closing);
        if (c !== 0)
            return c;
        if (a.line.key === null)
            return 1;
        if (b.line.key === null)
            return -1;
        return a.line.name.toLowerCase() < b.line.name.toLowerCase() ? -1 : 1;
    });
    return { rows: out.map((o) => o.line), total: { items: rows.length, ...total } };
}
function godownColumns(rows, branchGodowns) {
    const used = new Set();
    for (const r of rows) {
        for (const g of r.godowns) {
            if (!g.qty.isZero() || !g.value.isZero() || (g.bnd !== null && !g.bnd.isZero())) {
                used.add(g.godownId);
            }
        }
    }
    const known = branchGodowns.filter((g) => used.has(g.godownId));
    const extra = [...used]
        .filter((id) => !branchGodowns.some((g) => g.godownId === id))
        .sort()
        .map((godownId) => ({ godownId, name: godownId }));
    return [...known, ...extra];
}
function godownRow(r, columns) {
    let q = exports.D0;
    let v = exports.D0;
    const todayOnly = r.num.physical !== null;
    let p = exports.D0;
    const cells = columns.map((c) => {
        const g = r.godowns.find((x) => x.godownId === c.godownId);
        q = q.plus(g?.qty ?? exports.D0);
        v = v.plus(g?.value ?? exports.D0);
        const physical = (g?.qty ?? exports.D0).plus(g?.bnd ?? exports.D0);
        p = p.plus(physical);
        return {
            godownId: c.godownId,
            qty: qty(g?.qty ?? exports.D0, r.factor),
            value: money(g?.value ?? exports.D0),
            physical: todayOnly ? qty(physical, r.factor) : null,
        };
    });
    return {
        itemId: r.itemId,
        code: r.wire.code,
        name: r.wire.name,
        otherCompany: r.wire.otherCompany,
        defaultUnitId: r.wire.defaultUnitId,
        unit: r.wire.unit,
        cells,
        qty: qty(q, r.factor),
        value: money(v),
        physical: todayOnly ? qty(p, r.factor) : null,
    };
}
function godownTotals(rows, columns) {
    let all = exports.D0;
    const byGodown = columns.map((c) => {
        let v = exports.D0;
        for (const r of rows) {
            const g = r.godowns.find((x) => x.godownId === c.godownId);
            if (g)
                v = v.plus(g.value);
        }
        all = all.plus(v);
        return { godownId: c.godownId, value: money(v) };
    });
    return { byGodown, value: money(all) };
}
function buildBranchRows(input) {
    const byItem = new Map();
    const get = (item) => {
        let x = byItem.get(item);
        if (!x) {
            x = { cells: new Map(), tq: exports.D0, tv: exports.D0 };
            byItem.set(item, x);
        }
        return x;
    };
    for (const c of input.cells) {
        const x = get(c.item);
        const prev = x.cells.get(c.branch) ?? { q: exports.D0, v: exports.D0 };
        x.cells.set(c.branch, { q: prev.q.plus(c.q), v: prev.v.plus(c.v) });
    }
    for (const t of input.transit) {
        const x = get(t.item);
        x.tq = x.tq.plus(t.q);
        x.tv = x.tv.plus(t.v);
    }
    const facts = new Map(input.facts.map((f) => [f.item_id, f]));
    const rows = [];
    for (const [itemId, x] of byItem) {
        const f = facts.get(itemId);
        const { unit, factor } = unitOf(f, input.qtyIn);
        let cq = exports.D0;
        let cv = exports.D0;
        let anyNeg = false;
        const cells = input.columns.map((col) => {
            const c = x.cells.get(col.branchId) ?? { q: exports.D0, v: exports.D0 };
            cq = cq.plus(c.q);
            cv = cv.plus(c.v);
            if (c.q.lessThan(0))
                anyNeg = true;
            return { branchId: col.branchId, qty: c.q, value: c.v };
        });
        const chainQty = cq.plus(x.tq);
        const chainValue = cv.plus(x.tv);
        const wireCells = cells.map((c) => ({
            branchId: c.branchId,
            qty: qty(c.qty, factor),
            value: money(c.value),
        }));
        const wire = Object.freeze({
            itemId,
            code: f?.code ?? null,
            name: f?.name ?? '',
            groupName: f?.group_name ?? null,
            brandName: f?.brand_name ?? null,
            unit,
            otherCompany: !!f?.company_id && f.company_id !== input.companyId,
            defaultUnitId: f?.default_iuc_id ?? null,
            cells: wireCells,
            inTransit: { qty: qty(x.tq, factor), value: money(x.tv) },
            chain: { qty: qty(chainQty, factor), value: money(chainValue) },
        });
        rows.push(Object.freeze({
            wire,
            itemId,
            nameKey: (f?.name ?? '').toLowerCase(),
            codeKey: (f?.code ?? '').toLowerCase(),
            groupNameKey: (f?.group_name ?? '').toLowerCase(),
            brandNameKey: (f?.brand_name ?? '').toLowerCase(),
            findText: [f?.code, f?.name, f?.barcode, f?.sku]
                .filter(Boolean)
                .join('\u0001')
                .toLowerCase(),
            chainQty,
            chainValue,
            transitQty: x.tq,
            transitValue: x.tv,
            cells,
            flags: {
                zero: cells.every((c) => c.qty.isZero() && c.value.isZero()) && x.tq.isZero(),
                negative: anyNeg || chainQty.lessThan(0),
                inTransit: !x.tq.isZero(),
            },
        }));
    }
    return rows;
}
function branchView(rows, v) {
    const find = v.find.toLowerCase();
    const kept = rows.filter((r) => {
        if (v.hideZero && r.flags.zero)
            return false;
        if (v.onlyNegative && !r.chainQty.lessThan(0))
            return false;
        if (v.show === 'NEGATIVE' && !r.flags.negative)
            return false;
        if (v.show === 'IN_TRANSIT' && !r.flags.inTransit)
            return false;
        if (find && !r.findText.includes(find))
            return false;
        return true;
    });
    const key = (r) => {
        switch (v.sort) {
            case 'code':
                return r.codeKey;
            case 'group':
                return r.groupNameKey;
            case 'brand':
                return r.brandNameKey;
            case 'closing':
                return r.chainQty;
            case 'value':
                return r.chainValue;
            case 'inTransit':
                return r.transitQty;
            default:
                return r.nameKey;
        }
    };
    return sortRows(kept, key, v.dir);
}
function branchTotals(rows, columns, transfers) {
    let tv = exports.D0;
    let chain = exports.D0;
    const sums = new Map();
    for (const r of rows) {
        tv = tv.plus(r.transitValue);
        chain = chain.plus(r.chainValue);
        for (const c of r.cells)
            sums.set(c.branchId, (sums.get(c.branchId) ?? exports.D0).plus(c.value));
    }
    return {
        byBranch: columns.map((c) => ({
            branchId: c.branchId,
            value: money(sums.get(c.branchId) ?? exports.D0),
        })),
        inTransit: { value: money(tv), transfers },
        chain: { value: money(chain) },
    };
}
function printedAsOf(p) {
    return [
        p.branchName,
        `${(0, item_ledger_rules_1.dmy)(p.from)} → ${(0, item_ledger_rules_1.dmy)(p.to)}`,
        p.godownName ?? 'All godowns',
        p.groupName ? `Group: ${p.groupName}` : null,
        p.brandName ? `Brand: ${p.brandName}` : null,
        p.drill ?? null,
        p.bucket === 'ALL' ? 'All buckets' : (0, item_ledger_rules_1.bucketLabel)(p.bucket),
        p.valueAt === 'WITH_TAX' ? 'cost with tax' : 'cost without tax',
        p.qtyIn === 'DEFAULT' ? 'qty in default unit' : null,
        p.hideZero ? 'hide zero' : null,
        p.onlyNegative ? 'only negative' : null,
        p.show && p.show !== 'ALL' ? `show ${p.show.toLowerCase().replace(/_/g, ' ')}` : null,
        p.find ? `find "${p.find}"` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}
function chipsText(chips) {
    return chips
        .map((c) => {
        switch (c.kind) {
            case 'NEGATIVE':
                return 'NEGATIVE';
            case 'EXPIRY':
                return `EXP ${c.date ? `${c.date.slice(8, 10)}/${c.date.slice(5, 7)}` : ''}`.trim();
            case 'NO_SALE':
                return `NO SALE ${c.days ?? ''} D`.replace('  ', ' ');
            case 'NEVER_SOLD':
                return 'NEVER SOLD';
            case 'OTHER_COMPANY':
                return 'OTHER COMPANY';
            case 'NOT_TIED':
                return 'NOT TIED';
            default:
                return '';
        }
    })
        .filter(Boolean)
        .join(' · ');
}
//# sourceMappingURL=stock-summary.rules.js.map