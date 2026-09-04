"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceResultRows = coerceResultRows;
exports.duplicateColumns = duplicateColumns;
exports.coerceProviderValue = coerceProviderValue;
exports.coerceProviderRow = coerceProviderRow;
const scalar_text_1 = require("./scalar-text");
const OID = {
    BOOL: 16,
    INT8: 20,
    INT2: 21,
    INT4: 23,
    FLOAT4: 700,
    FLOAT8: 701,
    NUMERIC: 1700,
    JSON: 114,
    JSONB: 3802,
    TIMESTAMP: 1114,
    TIMESTAMPTZ: 1184,
    DATE: 1082,
};
const NUMERIC_OIDS = new Set([OID.INT2, OID.INT4, OID.FLOAT4, OID.FLOAT8, OID.NUMERIC]);
const PASSTHROUGH_OIDS = new Set([OID.JSON, OID.JSONB, OID.BOOL, OID.DATE]);
function coerceBigInt(value) {
    if (value === null || value === undefined)
        return null;
    const text = (0, scalar_text_1.toScalarText)(value);
    const parsed = Number(text);
    return Number.isSafeInteger(parsed) ? parsed : text;
}
function coerceByOid(value, oid) {
    if (value === null || value === undefined)
        return null;
    if (NUMERIC_OIDS.has(oid)) {
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (oid === OID.INT8)
        return coerceBigInt(value);
    if (oid === OID.TIMESTAMP || oid === OID.TIMESTAMPTZ) {
        return value instanceof Date ? value.toISOString() : (0, scalar_text_1.toScalarText)(value);
    }
    if (PASSTHROUGH_OIDS.has(oid))
        return value;
    if (typeof value === 'bigint')
        return coerceBigInt(value);
    if (Array.isArray(value) || (typeof value === 'object' && value instanceof Date)) {
        return value instanceof Date ? value.toISOString() : value;
    }
    return typeof value === 'object' ? value : (0, scalar_text_1.toScalarText)(value);
}
function coerceResultRows(result) {
    const fields = result.fields.map((field) => ({ name: field.name, oid: field.dataTypeID }));
    return result.rows.map((row) => {
        const out = {};
        for (const field of fields) {
            out[field.name] = coerceByOid(row[field.name], field.oid);
        }
        return out;
    });
}
function duplicateColumns(result) {
    const seen = new Set();
    const duplicated = new Set();
    for (const field of result.fields) {
        if (seen.has(field.name))
            duplicated.add(field.name);
        seen.add(field.name);
    }
    return [...duplicated];
}
function coerceProviderValue(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'bigint')
        return coerceBigInt(value);
    if (typeof value === 'object' &&
        'toNumber' in value &&
        typeof value.toNumber === 'function') {
        const parsed = value.toNumber();
        return Number.isFinite(parsed) ? parsed : null;
    }
    return value;
}
function coerceProviderRow(row) {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
        out[key] = coerceProviderValue(value);
    }
    return out;
}
//# sourceMappingURL=value-coercion.js.map