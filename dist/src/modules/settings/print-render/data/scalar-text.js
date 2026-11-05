"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toScalarText = toScalarText;
function toScalarText(value) {
    if (value === null || value === undefined)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (value instanceof Date)
        return value.toISOString();
    try {
        return JSON.stringify(value) ?? '';
    }
    catch {
        return '[unprintable]';
    }
}
//# sourceMappingURL=scalar-text.js.map