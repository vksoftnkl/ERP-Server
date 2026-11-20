"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COUNTRY_CODE = void 0;
exports.normalisePhone = normalisePhone;
exports.normalisedOrNull = normalisedOrNull;
exports.choosePhone = choosePhone;
exports.phoneCandidates = phoneCandidates;
const wa_constants_1 = require("./wa.constants");
exports.DEFAULT_COUNTRY_CODE = '91';
function normalisePhone(raw, countryCode = exports.DEFAULT_COUNTRY_CODE) {
    let digits = (raw ?? '').replace(/\D/g, '');
    if (!digits) {
        return { ok: false, reason: 'EMPTY' };
    }
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }
    else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
    }
    if (digits.length === 10) {
        digits = countryCode + digits;
    }
    if (digits.length < 11 || digits.length > 15) {
        return { ok: false, reason: 'BAD' };
    }
    if (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) {
        return { ok: false, reason: 'BAD' };
    }
    return { ok: true, phone: digits };
}
function normalisedOrNull(raw) {
    const v = normalisePhone(raw);
    return v.ok ? v.phone : null;
}
function choosePhone(candidates) {
    const tried = [];
    for (const c of candidates) {
        const v = normalisePhone(c.raw);
        if (v.ok) {
            return { ok: true, phone: v.phone, source: c.source };
        }
        if (v.reason === 'BAD') {
            tried.push(c.source);
        }
    }
    return tried.length > 0
        ? { ok: false, code: wa_constants_1.WA_CODES.BAD_NUMBER, tried }
        : { ok: false, code: wa_constants_1.WA_CODES.NO_NUMBER, tried };
}
function phoneCandidates(p) {
    const out = [];
    if (p.bodyPhone) {
        out.push({ source: 'TYPED', raw: p.bodyPhone });
    }
    if (!p.walkIn && p.ledger) {
        out.push({ source: 'WHATSAPP', raw: p.ledger.whatsapp });
        out.push({ source: 'PHONE1', raw: p.ledger.phone1 });
        out.push({ source: 'PHONE2', raw: p.ledger.phone2 });
    }
    if (p.docPhone) {
        out.push({ source: 'TYPED', raw: p.docPhone });
    }
    return out;
}
//# sourceMappingURL=wa-phone.js.map