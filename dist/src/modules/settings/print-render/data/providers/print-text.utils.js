"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderMemo = exports.UUID = void 0;
exports.decOf = decOf;
exports.qtyText = qtyText;
exports.numOf = numOf;
exports.dmyText = dmyText;
exports.istText = istText;
exports.countText = countText;
exports.uuidList = uuidList;
const client_1 = require("@prisma/client");
function decOf(value) {
    if (value === null || value === undefined || value === '')
        return new client_1.Prisma.Decimal(0);
    try {
        return new client_1.Prisma.Decimal(value);
    }
    catch {
        return new client_1.Prisma.Decimal(0);
    }
}
function groupIndian(whole) {
    if (whole.length <= 3)
        return whole;
    const last = whole.slice(-3);
    const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${rest},${last}`;
}
function qtyText(value, dp = 3) {
    const d = decOf(value).toDecimalPlaces(dp, client_1.Prisma.Decimal.ROUND_HALF_UP);
    if (d.isZero())
        return '0';
    const negative = d.isNegative();
    const [whole, frac = ''] = d.abs().toFixed(dp).split('.');
    const trimmed = frac.replace(/0+$/, '');
    return `${negative ? '-' : ''}${groupIndian(whole)}${trimmed ? `.${trimmed}` : ''}`;
}
function numOf(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const n = Number(decOf(value).toString());
    return Number.isFinite(n) ? n : null;
}
function dmyText(value) {
    if (!value)
        return '';
    const iso = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
        return '';
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
function istText(at) {
    if (!at)
        return '';
    const when = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(when.getTime()))
        return '';
    const ist = new Date(when.getTime() + 330 * 60_000);
    const dd = String(ist.getUTCDate()).padStart(2, '0');
    const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const hh = ist.getUTCHours();
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    const mi = String(ist.getUTCMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${ist.getUTCFullYear()} ${String(h12).padStart(2, '0')}:${mi} ${hh < 12 ? 'AM' : 'PM'}`;
}
function countText(n, one, many = `${one}s`) {
    return `${n} ${n === 1 ? one : many}`;
}
function uuidList(raw, what, max = 1000) {
    const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join(',') : '';
    const out = [];
    const seen = new Set();
    for (const part of text.split(/[\s,;]+/)) {
        const id = part.trim().toLowerCase();
        if (!id)
            continue;
        if (!exports.UUID.test(id)) {
            throw new Error(`${what}: '${part.trim()}' is not an id. Send the ids comma separated.`);
        }
        if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    if (out.length > max) {
        throw new Error(`${what}: ${out.length} ids sent; at most ${max} print at once.`);
    }
    return out;
}
exports.UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class RenderMemo {
    keepMs;
    runs = new Map();
    constructor(keepMs = 5_000) {
        this.keepMs = keepMs;
    }
    get(key, work) {
        const running = this.runs.get(key);
        if (running)
            return running;
        const started = work();
        this.runs.set(key, started);
        const forget = () => {
            const timer = setTimeout(() => {
                if (this.runs.get(key) === started)
                    this.runs.delete(key);
            }, this.keepMs);
            timer.unref?.();
        };
        started.then(forget, () => this.runs.delete(key));
        return started;
    }
}
exports.RenderMemo = RenderMemo;
//# sourceMappingURL=print-text.utils.js.map