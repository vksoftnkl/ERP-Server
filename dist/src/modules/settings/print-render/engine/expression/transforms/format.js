"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = exports.formatNumberIntl = exports.formatNumber = exports.groupWestern = exports.groupIndian = void 0;
const scalar_1 = require("./scalar");
const groupIndian = (wholeDigits) => {
    const negative = wholeDigits.startsWith('-');
    const digits = negative ? wholeDigits.slice(1) : wholeDigits;
    if (digits.length <= 3) {
        return negative ? `-${digits}` : digits;
    }
    const lastThree = digits.slice(-3);
    const rest = digits.slice(0, -3);
    const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    const result = `${grouped},${lastThree}`;
    return negative ? `-${result}` : result;
};
exports.groupIndian = groupIndian;
const groupWestern = (wholeDigits) => {
    const negative = wholeDigits.startsWith('-');
    const digits = negative ? wholeDigits.slice(1) : wholeDigits;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return negative ? `-${grouped}` : grouped;
};
exports.groupWestern = groupWestern;
const parseNumberPattern = (pattern) => {
    const [wholePart, fractionPart = ''] = pattern.split('.');
    return {
        decimals: (fractionPart.match(/[0#]/g) ?? []).length,
        grouped: wholePart.includes(','),
        minIntegerDigits: (wholePart.match(/0/g) ?? []).length,
    };
};
const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const numeric = typeof value === 'number' ? value : Number((0, scalar_1.scalarToString)(value));
    return Number.isFinite(numeric) ? numeric : null;
};
const applyNumberPattern = (value, pattern, group) => {
    const { decimals, grouped, minIntegerDigits } = parseNumberPattern(pattern);
    const fixed = value.toFixed(decimals);
    const normalised = Object.is(Number(fixed), -0) ? (0).toFixed(decimals) : fixed;
    const negative = normalised.startsWith('-');
    const unsigned = negative ? normalised.slice(1) : normalised;
    const [whole, fraction] = unsigned.split('.');
    const padded = whole.padStart(Math.max(minIntegerDigits, 1), '0');
    const wholeOut = grouped ? group(padded) : padded;
    const body = fraction ? `${wholeOut}.${fraction}` : wholeOut;
    return negative ? `-${body}` : body;
};
const formatNumber = (value, pattern = '0.00', group = exports.groupIndian) => {
    const numeric = toFiniteNumber(value);
    if (numeric === null) {
        return '';
    }
    const [positivePattern, negativePattern] = String(pattern).split(';');
    if (numeric < 0 && negativePattern) {
        const formatted = applyNumberPattern(Math.abs(numeric), negativePattern, group);
        return negativePattern.replace(/[#0.,]+/, formatted);
    }
    return applyNumberPattern(numeric, positivePattern, group);
};
exports.formatNumber = formatNumber;
const formatNumberIntl = (value, pattern = '0.00') => (0, exports.formatNumber)(value, pattern, exports.groupWestern);
exports.formatNumberIntl = formatNumberIntl;
const MONTH_NAMES_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
const MONTH_NAMES_LONG = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toDate = (value) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
        const fromEpoch = new Date(value);
        return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};
const formatDate = (value, pattern = 'dd-MM-yyyy') => {
    const date = toDate(value);
    if (!date) {
        return '';
    }
    const pad = (input, width = 2) => String(input).padStart(width, '0');
    const hours24 = date.getUTCHours();
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const replacements = [
        ['yyyy', String(date.getUTCFullYear())],
        ['yy', pad(date.getUTCFullYear() % 100)],
        ['MMMM', MONTH_NAMES_LONG[date.getUTCMonth()]],
        ['MMM', MONTH_NAMES_SHORT[date.getUTCMonth()]],
        ['MM', pad(date.getUTCMonth() + 1)],
        ['ddd', DAY_NAMES_SHORT[date.getUTCDay()]],
        ['dd', pad(date.getUTCDate())],
        ['HH', pad(hours24)],
        ['hh', pad(hours12)],
        ['mm', pad(date.getUTCMinutes())],
        ['ss', pad(date.getUTCSeconds())],
        ['tt', hours24 < 12 ? 'AM' : 'PM'],
    ];
    let output = '';
    let cursor = 0;
    outer: while (cursor < pattern.length) {
        for (const [token, replacement] of replacements) {
            if (pattern.startsWith(token, cursor)) {
                output += replacement;
                cursor += token.length;
                continue outer;
            }
        }
        output += pattern[cursor];
        cursor += 1;
    }
    return output;
};
exports.formatDate = formatDate;
//# sourceMappingURL=format.js.map