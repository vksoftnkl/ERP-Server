"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upperStateCode = exports.PIN_MAX = exports.PIN_MIN = exports.GST_REGISTERED_TYPES = void 0;
exports.isGstRegistered = isGstRegistered;
exports.isValidPin = isValidPin;
exports.isBlank = isBlank;
exports.blankKeys = blankKeys;
exports.GST_REGISTERED_TYPES = ['REGULAR', 'COMPOSITION', 'SEZ'];
exports.PIN_MIN = 100000;
exports.PIN_MAX = 999999;
function isGstRegistered(regType) {
    return typeof regType === 'string' && exports.GST_REGISTERED_TYPES.includes(regType.trim().toUpperCase());
}
function isValidPin(pin) {
    return Number.isInteger(pin) && pin >= exports.PIN_MIN && pin <= exports.PIN_MAX;
}
function isBlank(value) {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'string') {
        return value.trim() === '';
    }
    return typeof value === 'number' && Number.isNaN(value);
}
function blankKeys(values, keys) {
    return keys.filter((key) => isBlank(values[key]));
}
const upperStateCode = ({ value }) => value === null ? '' : typeof value === 'string' ? value.trim().toUpperCase() : value;
exports.upperStateCode = upperStateCode;
//# sourceMappingURL=registered-address.js.map