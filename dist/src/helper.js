"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOptionalBoolean = void 0;
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
//# sourceMappingURL=helper.js.map