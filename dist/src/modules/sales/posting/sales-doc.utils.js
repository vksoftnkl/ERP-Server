"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALES_MENU_ID = exports.SALES_VOUCHER_TYPE = exports.TENDER_TYPE = void 0;
exports.round2 = round2;
exports.round4 = round4;
exports.money = money;
exports.num = num;
exports.isoDate = isoDate;
exports.isoDateTime = isoDateTime;
exports.isoToday = isoToday;
exports.daysBetween = daysBetween;
exports.addDays = addDays;
exports.accYearOf = accYearOf;
exports.supplyNatureOf = supplyNatureOf;
exports.numericTail = numericTail;
exports.bucketTaxes = bucketTaxes;
function round2(v) {
    return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
function round4(v) {
    return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 10_000) / 10_000;
}
function money(v) {
    return round2(v).toFixed(2);
}
function num(v) {
    if (v === null || v === undefined) {
        return 0;
    }
    if (typeof v === 'number') {
        return Number.isFinite(v) ? v : 0;
    }
    if (typeof v === 'bigint') {
        return Number(v);
    }
    const n = Number(typeof v === 'string' ? v : v.toString());
    return Number.isFinite(n) ? n : 0;
}
function isoDate(d) {
    if (!d) {
        return null;
    }
    if (typeof d === 'string') {
        return d.length >= 10 ? d.slice(0, 10) : d;
    }
    return d.toISOString().slice(0, 10);
}
function isoDateTime(d) {
    return d ? d.toISOString() : null;
}
function isoToday() {
    return new Date().toISOString().slice(0, 10);
}
function daysBetween(from, to) {
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
}
function addDays(from, days) {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function accYearOf(date) {
    const d = new Date(`${date}T00:00:00Z`);
    const y = d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    return `${y}-${y + 1}`;
}
function supplyNatureOf(companyStateCode, posStateCode) {
    const c = (companyStateCode ?? '').trim();
    const p = (posStateCode ?? '').trim();
    if (!c || !p) {
        return 'INTRA';
    }
    return c === p ? 'INTRA' : 'INTER';
}
function numericTail(refno, fallback) {
    const m = /(\d+)\s*$/.exec(refno ?? '');
    if (!m) {
        return fallback;
    }
    try {
        return BigInt(m[1]);
    }
    catch {
        return fallback;
    }
}
function bucketTaxes(rows) {
    const by = new Map();
    for (const r of rows) {
        const key = r.taxId ?? '*';
        const b = by.get(key) ?? { taxId: r.taxId, cgst: 0, sgst: 0, igst: 0, cess: 0, acess: 0 };
        b.cgst += r.cgst;
        b.sgst += r.sgst;
        b.igst += r.igst;
        b.cess += r.cess;
        b.acess += r.acess ?? 0;
        by.set(key, b);
    }
    return [...by.values()].map((b) => ({
        taxId: b.taxId,
        cgst: round2(b.cgst),
        sgst: round2(b.sgst),
        igst: round2(b.igst),
        cess: round2(b.cess),
        acess: round2(b.acess),
    }));
}
exports.TENDER_TYPE = {
    CASH: 1,
    CARD: 2,
    UPI: 3,
    WALLET: 4,
    CHEQUE: 5,
    BANK: 6,
    RRN: 7,
    TEMP_CREDIT: 8,
    CREDIT: 9,
    LOYALTY: 10,
    VOUCHER: 11,
};
exports.SALES_VOUCHER_TYPE = {
    BILL: 3,
    ORDER: 4,
    SALE_RETURN: 18,
    DELIVERY_CHALLAN: 19,
    DC_RETURN: 20,
    TENDER_CHANGE: 22,
};
exports.SALES_MENU_ID = {
    SALE_BILL: 12,
    SALES_ORDER: 11,
    SALE_RETURN: 13,
    DELIVERY_CHALLAN: 182,
    DC_RETURN: 182,
    TEMP_CREDIT: 12,
};
//# sourceMappingURL=sales-doc.utils.js.map