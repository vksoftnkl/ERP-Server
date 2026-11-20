"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPLOYEE_COMMISSION_VALUE_PATTERN = exports.EMPLOYEE_IFSC_PATTERN = exports.COMMISSION_TYPES = exports.EMPLOYMENT_TYPES = exports.EMPLOYEE_STATUS_RESIGNED = exports.EMPLOYEE_STATUS_WORKING = exports.EMPLOYEE_STATUSES = void 0;
exports.canonicalListValue = canonicalListValue;
exports.EMPLOYEE_STATUSES = ['Working', 'Resigned'];
exports.EMPLOYEE_STATUS_WORKING = 'Working';
exports.EMPLOYEE_STATUS_RESIGNED = 'Resigned';
exports.EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Daily Wage', 'Apprentice'];
exports.COMMISSION_TYPES = ['Percent', 'Amount'];
const matchKey = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');
function canonicalListValue(value, list, blank) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return blank;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return blank;
    }
    const key = matchKey(trimmed);
    return list.find((entry) => matchKey(entry) === key) ?? trimmed;
}
exports.EMPLOYEE_IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
exports.EMPLOYEE_COMMISSION_VALUE_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;
//# sourceMappingURL=employee-master-values.js.map