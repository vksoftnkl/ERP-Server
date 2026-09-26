"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLookupToken = normalizeLookupToken;
exports.resolveRowLookupKeys = resolveRowLookupKeys;
exports.resolveConfiguredLookupKeys = resolveConfiguredLookupKeys;
exports.resolveLikelyIdKey = resolveLikelyIdKey;
exports.resolveLikelyNameKey = resolveLikelyNameKey;
exports.readLookupRowValue = readLookupRowValue;
exports.toLookupValue = toLookupValue;
const master_lookup_constants_1 = require("../master-lookup.constants");
function normalizeLookupToken(value) {
    if (!value)
        return '';
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((token) => token && !master_lookup_constants_1.LOOKUP_NAME_NOISE_TOKENS.has(token))
        .join(' ');
}
function resolveRowLookupKeys(row) {
    return normalizeUniqueTokens(Object.keys(row));
}
function resolveConfiguredLookupKeys(columns) {
    return normalizeUniqueTokens(columns.flatMap((col) => [col.name, col.alias]));
}
function resolveLikelyIdKey(keys) {
    return keys.find((key) => isLikelyIdKey(key)) ?? keys[0];
}
function resolveLikelyNameKey(keys, idKey, fallbackToId = true) {
    return (keys.find((key) => key !== idKey && isLikelyNameKey(key)) ??
        keys.find((key) => key !== idKey) ??
        (fallbackToId ? idKey : undefined));
}
function readLookupRowValue(row, normalizedKey) {
    for (const [actualKey, value] of Object.entries(row)) {
        if (normalizeLookupToken(actualKey) === normalizedKey) {
            return toLookupValue(value);
        }
    }
    return undefined;
}
function toLookupValue(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (typeof value === 'number' || typeof value === 'bigint')
        return String(value);
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    return undefined;
}
function isLikelyIdKey(value) {
    const tokens = value.split(' ').filter(Boolean);
    return tokens.includes('id') || tokens.includes('uuid') || tokens.includes('value');
}
function isLikelyNameKey(value) {
    const tokens = value.split(' ').filter(Boolean);
    return (tokens.includes('name') ||
        tokens.includes('label') ||
        tokens.includes('title') ||
        tokens.includes('alias') ||
        tokens.includes('short') ||
        tokens.includes('description'));
}
function normalizeUniqueTokens(values) {
    const seen = new Set();
    const keys = [];
    for (const value of values) {
        const normalized = normalizeLookupToken(value);
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            keys.push(normalized);
        }
    }
    return keys;
}
//# sourceMappingURL=lookup-key.utils.js.map