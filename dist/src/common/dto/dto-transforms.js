"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAliasValue = exports.toOptionalBoolean = exports.toOptionalNumber = exports.toOptionalInteger = exports.toNullableString = exports.toNullableUuid = exports.toTrimmedString = exports.toOptionalUuid = void 0;
const toOptionalUuid = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    return value;
};
exports.toOptionalUuid = toOptionalUuid;
const toTrimmedString = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
};
exports.toTrimmedString = toTrimmedString;
const toNullableUuid = (value) => {
    if (value === undefined || value === '') {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    return value;
};
exports.toNullableUuid = toNullableUuid;
const toNullableString = (value) => {
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
    return trimmed || null;
};
exports.toNullableString = toNullableString;
const toOptionalInteger = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : value;
};
exports.toOptionalInteger = toOptionalInteger;
const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
};
exports.toOptionalNumber = toOptionalNumber;
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
//# sourceMappingURL=dto-transforms.js.map