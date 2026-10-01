"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mask = exports.wrapText = exports.coalesce = exports.repeat = exports.truncate = exports.padCenter = exports.padEnd = exports.padStart = exports.titleCase = exports.trim = exports.lower = exports.upper = void 0;
const asText = (value) => {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : '';
};
const upper = (value) => asText(value).toUpperCase();
exports.upper = upper;
const lower = (value) => asText(value).toLowerCase();
exports.lower = lower;
const trim = (value) => asText(value).trim();
exports.trim = trim;
const titleCase = (value) => asText(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());
exports.titleCase = titleCase;
const padStart = (value, width, fill = ' ') => asText(value).padStart(Math.max(0, Math.trunc(width)), fill || ' ');
exports.padStart = padStart;
const padEnd = (value, width, fill = ' ') => asText(value).padEnd(Math.max(0, Math.trunc(width)), fill || ' ');
exports.padEnd = padEnd;
const padCenter = (value, width, fill = ' ') => {
    const text = asText(value);
    const target = Math.max(0, Math.trunc(width));
    if (text.length >= target) {
        return text;
    }
    const totalPad = target - text.length;
    const left = Math.floor(totalPad / 2);
    const filler = fill || ' ';
    return filler.repeat(left) + text + filler.repeat(totalPad - left);
};
exports.padCenter = padCenter;
const truncate = (value, width, ellipsis = '') => {
    const text = asText(value);
    const target = Math.max(0, Math.trunc(width));
    if (text.length <= target) {
        return text;
    }
    if (!ellipsis || target <= ellipsis.length) {
        return text.slice(0, target);
    }
    return text.slice(0, target - ellipsis.length) + ellipsis;
};
exports.truncate = truncate;
const repeat = (value, count) => asText(value).repeat(Math.max(0, Math.min(2_000, Math.trunc(count))));
exports.repeat = repeat;
const coalesce = (value, ...fallbacks) => {
    const candidates = [value, ...fallbacks];
    for (const candidate of candidates) {
        const text = asText(candidate).trim();
        if (text) {
            return text;
        }
    }
    return '';
};
exports.coalesce = coalesce;
const wrapText = (value, width) => {
    const text = asText(value).replace(/\s+/g, ' ').trim();
    const target = Math.max(1, Math.trunc(width));
    if (!text) {
        return [];
    }
    const lines = [];
    let current = '';
    for (const word of text.split(' ')) {
        if (!current) {
            current = word;
        }
        else if (current.length + 1 + word.length <= target) {
            current += ` ${word}`;
        }
        else {
            lines.push(current);
            current = word;
        }
        while (current.length > target) {
            lines.push(current.slice(0, target));
            current = current.slice(target);
        }
    }
    if (current) {
        lines.push(current);
    }
    return lines;
};
exports.wrapText = wrapText;
const mask = (value, visible = 4, maskChar = 'X') => {
    const text = asText(value);
    const keep = Math.max(0, Math.trunc(visible));
    if (text.length <= keep) {
        return text;
    }
    return (maskChar || 'X').repeat(text.length - keep) + text.slice(-keep);
};
exports.mask = mask;
//# sourceMappingURL=text.js.map