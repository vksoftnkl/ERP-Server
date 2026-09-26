"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAA_GSTIN_REGEX = exports.SAA_STATE_CODE_REGEX = exports.SAA_PIN_REGEX = exports.DEFAULT_COUNTRY_CODE = void 0;
exports.assertSaaAddrType = assertSaaAddrType;
exports.assertSaaStateCode = assertSaaStateCode;
exports.assertSaaPin = assertSaaPin;
exports.assertSaaGstin = assertSaaGstin;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const ledger_shipping_address_enum_1 = require("./types/ledger-shipping-address-enum");
exports.DEFAULT_COUNTRY_CODE = 'IN';
exports.SAA_PIN_REGEX = /^[0-9]{6}$/;
exports.SAA_STATE_CODE_REGEX = /^[0-9]{2}$/;
exports.SAA_GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const SAA_ADDR_TYPES = Object.values(ledger_shipping_address_enum_1.SaaAddrType);
function assertSaaAddrType(value) {
    const normalized = value.trim().toUpperCase();
    if (!SAA_ADDR_TYPES.includes(normalized)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'saaAddrType',
                message: `saaAddrType must be one of ${SAA_ADDR_TYPES.join(', ')}`,
            },
        ]);
    }
    return normalized;
}
function assertSaaStateCode(value) {
    if (value === null || value === undefined) {
        return;
    }
    if (!exports.SAA_STATE_CODE_REGEX.test(value)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'saaStateCode',
                message: 'saaStateCode must be a 2-digit GST state code',
            },
        ]);
    }
}
function assertSaaPin(value, countryCode) {
    if (value === null || value === undefined) {
        return;
    }
    const country = (countryCode ?? exports.DEFAULT_COUNTRY_CODE).trim().toUpperCase();
    if (country !== exports.DEFAULT_COUNTRY_CODE) {
        return;
    }
    if (!exports.SAA_PIN_REGEX.test(value)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'saaPin',
                message: 'saaPin must be a 6-digit PIN code for India',
            },
        ]);
    }
}
function assertSaaGstin(value) {
    const normalized = (value ?? '').trim().toUpperCase();
    if (!normalized) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'saaGstin',
                message: 'saaGstin is required',
            },
        ]);
    }
    if (!exports.SAA_GSTIN_REGEX.test(normalized)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'saaGstin',
                message: 'saaGstin must be a valid 15-character GSTIN',
            },
        ]);
    }
    return normalized;
}
//# sourceMappingURL=ledger-shipping-address.validation.js.map