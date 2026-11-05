"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAliasValue = exports.toUpper = exports.toOptionalTrimmedString = exports.toNullableDate = exports.toOptionalDate = exports.toNullableIdString = exports.toOptionalIdString = exports.toNullableLowerString = exports.toLowerTrimmed = exports.toNullableUpperString = exports.toUpperTrimmed = exports.toOptionalTimeString = exports.toOptionalDateString = exports.toOptionalBoolean = exports.toOptionalIntegerArray = exports.toNullableNumberStrict = exports.toOptionalNumber = exports.toInteger = exports.toRequiredInteger = exports.toNullableIntegerStrict = exports.toNullableInteger = exports.toOptionalInteger = exports.toRequiredUuid = exports.toNullableUuid = exports.toOptionalUuid = exports.toNullableStringStrict = exports.toNullableString = exports.TIME_PATTERN = exports.UUID_PATTERN = exports.toTrimmedString = void 0;
const toTrimmedString = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
};
exports.toTrimmedString = toTrimmedString;
exports.UUID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i;
exports.TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?$/;
const toNullableString = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};
exports.toNullableString = toNullableString;
const toNullableStringStrict = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};
exports.toNullableStringStrict = toNullableStringStrict;
const toOptionalUuid = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
};
exports.toOptionalUuid = toOptionalUuid;
const toNullableUuid = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    const parsed = (0, exports.toOptionalUuid)(value);
    return parsed === undefined ? null : parsed;
};
exports.toNullableUuid = toNullableUuid;
const toRequiredUuid = (value) => {
    const parsed = (0, exports.toOptionalUuid)(value);
    return parsed === undefined ? '' : parsed;
};
exports.toRequiredUuid = toRequiredUuid;
const toOptionalInteger = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : Number.NaN;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return undefined;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) ? parsed : Number.NaN;
    }
    return Number.NaN;
};
exports.toOptionalInteger = toOptionalInteger;
const toNullableInteger = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    const parsed = (0, exports.toOptionalInteger)(value);
    return parsed === undefined ? null : parsed;
};
exports.toNullableInteger = toNullableInteger;
const toNullableIntegerStrict = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) ? parsed : value;
    }
    return value;
};
exports.toNullableIntegerStrict = toNullableIntegerStrict;
const toRequiredInteger = (value) => {
    const parsed = (0, exports.toOptionalInteger)(value);
    return parsed === undefined ? Number.NaN : parsed;
};
exports.toRequiredInteger = toRequiredInteger;
const toInteger = (value) => {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return value;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) ? parsed : value;
    }
    return value;
};
exports.toInteger = toInteger;
const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
};
exports.toOptionalNumber = toOptionalNumber;
const toNullableNumberStrict = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
};
exports.toNullableNumberStrict = toNullableNumberStrict;
const toOptionalIntegerArray = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return [];
    }
    if (Array.isArray(value)) {
        return value.map((entry) => Number(entry));
    }
    if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
            return [];
        }
        const withoutBrackets = normalized.startsWith('[') && normalized.endsWith(']')
            ? normalized.slice(1, -1).trim()
            : normalized;
        const splitValues = withoutBrackets.includes(',')
            ? withoutBrackets.split(',')
            : withoutBrackets
                ? [withoutBrackets]
                : [];
        return splitValues.map((entry) => Number(entry.trim()));
    }
    return value;
};
exports.toOptionalIntegerArray = toOptionalIntegerArray;
const toOptionalBoolean = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'no', 'off'].includes(normalized)) {
            return false;
        }
    }
    return value;
};
exports.toOptionalBoolean = toOptionalBoolean;
const toOptionalDateString = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
};
exports.toOptionalDateString = toOptionalDateString;
const toOptionalTimeString = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
};
exports.toOptionalTimeString = toOptionalTimeString;
const toUpperTrimmed = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim().toUpperCase();
};
exports.toUpperTrimmed = toUpperTrimmed;
const toNullableUpperString = (value) => {
    const normalized = (0, exports.toNullableString)(value);
    if (normalized === undefined || normalized === null) {
        return normalized;
    }
    return normalized.toUpperCase();
};
exports.toNullableUpperString = toNullableUpperString;
const toLowerTrimmed = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim().toLowerCase();
};
exports.toLowerTrimmed = toLowerTrimmed;
const toNullableLowerString = (value) => {
    const normalized = (0, exports.toNullableString)(value);
    if (normalized === undefined || normalized === null) {
        return normalized;
    }
    return normalized.toLowerCase();
};
exports.toNullableLowerString = toNullableLowerString;
const toOptionalIdString = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value);
    }
    return value;
};
exports.toOptionalIdString = toOptionalIdString;
const toNullableIdString = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value);
    }
    return value;
};
exports.toNullableIdString = toNullableIdString;
const toOptionalDate = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
};
exports.toOptionalDate = toOptionalDate;
const toNullableDate = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
};
exports.toNullableDate = toNullableDate;
const toOptionalTrimmedString = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
};
exports.toOptionalTrimmedString = toOptionalTrimmedString;
exports.toUpper = exports.toUpperTrimmed;
const resolveAliasValue = (value, obj, aliases) => {
    if (value !== undefined) {
        return value;
    }
    if (typeof obj !== 'object' || obj === null) {
        return undefined;
    }
    const source = obj;
    for (const alias of aliases) {
        const aliasValue = source[alias];
        if (aliasValue !== undefined) {
            return aliasValue;
        }
    }
    return undefined;
};
exports.resolveAliasValue = resolveAliasValue;
//# sourceMappingURL=DtoTransforms.js.map