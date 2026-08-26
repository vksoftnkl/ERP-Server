"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.round3 = exports.round2 = exports.joinAddress = exports.toBigIntText = exports.toText = exports.toIsoDateTime = exports.toDateOnly = exports.toNullableNumber = exports.toNumber = void 0;
const toNumber = (value) => {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    const numeric = Number(value.toString());
    return Number.isFinite(numeric) ? numeric : 0;
};
exports.toNumber = toNumber;
const toNullableNumber = (value) => (value === null || value === undefined ? null : (0, exports.toNumber)(value));
exports.toNullableNumber = toNullableNumber;
const toDateOnly = (value) => {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};
exports.toDateOnly = toDateOnly;
const toIsoDateTime = (value) => {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
exports.toIsoDateTime = toIsoDateTime;
const toText = (value) => {
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
exports.toText = toText;
const toBigIntText = (value) => value === null || value === undefined ? '' : value.toString();
exports.toBigIntText = toBigIntText;
const joinAddress = (...parts) => parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
exports.joinAddress = joinAddress;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
exports.round2 = round2;
const round3 = (value) => Math.round((value + Number.EPSILON) * 1000) / 1000;
exports.round3 = round3;
//# sourceMappingURL=provider.utils.js.map