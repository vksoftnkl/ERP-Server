"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scalarToString = void 0;
const scalarToString = (value) => {
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
exports.scalarToString = scalarToString;
//# sourceMappingURL=scalar.js.map