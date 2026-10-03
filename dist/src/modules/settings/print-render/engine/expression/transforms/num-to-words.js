"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.numberToIndianWords = exports.integerToIndianWords = void 0;
const ONES = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigitsToWords = (value) => {
    if (value < 20) {
        return ONES[value];
    }
    const tens = TENS[Math.floor(value / 10)];
    const ones = ONES[value % 10];
    return ones ? `${tens} ${ones}` : tens;
};
const threeDigitsToWords = (value) => {
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    const parts = [];
    if (hundreds > 0) {
        parts.push(`${ONES[hundreds]} Hundred`);
    }
    if (remainder > 0) {
        parts.push(hundreds > 0 ? `and ${twoDigitsToWords(remainder)}` : twoDigitsToWords(remainder));
    }
    return parts.join(' ');
};
const integerToIndianWords = (value) => {
    const whole = Math.floor(Math.abs(value));
    if (whole === 0) {
        return 'Zero';
    }
    const crore = Math.floor(whole / 10_000_000);
    const lakh = Math.floor((whole % 10_000_000) / 100_000);
    const thousand = Math.floor((whole % 100_000) / 1_000);
    const rest = whole % 1_000;
    const parts = [];
    if (crore > 0) {
        parts.push(`${crore > 999 ? (0, exports.integerToIndianWords)(crore) : threeDigitsToWords(crore)} Crore`);
    }
    if (lakh > 0) {
        parts.push(`${twoDigitsToWords(lakh)} Lakh`);
    }
    if (thousand > 0) {
        parts.push(`${twoDigitsToWords(thousand)} Thousand`);
    }
    if (rest > 0) {
        parts.push(threeDigitsToWords(rest));
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
};
exports.integerToIndianWords = integerToIndianWords;
const numberToIndianWords = (value, options = {}) => {
    const { currency = 'Rupees', subCurrency = 'Paise', only = true, decimals = 2 } = options;
    const numeric = typeof value === 'number'
        ? value
        : Number(typeof value === 'object' && value !== null
            ? value.toString()
            : (value ?? ''));
    if (!Number.isFinite(numeric)) {
        return '';
    }
    const negative = numeric < 0;
    const magnitude = Math.abs(numeric);
    const scale = 10 ** decimals;
    const rounded = Math.round(magnitude * scale) / scale;
    const whole = Math.floor(rounded);
    const fraction = Math.round((rounded - whole) * scale);
    const parts = [];
    if (negative) {
        parts.push('Minus');
    }
    if (currency) {
        parts.push(currency);
    }
    parts.push((0, exports.integerToIndianWords)(whole));
    if (fraction > 0) {
        parts.push('and');
        if (subCurrency) {
            parts.push(subCurrency);
        }
        parts.push((0, exports.integerToIndianWords)(fraction));
    }
    if (only) {
        parts.push('Only');
    }
    return parts.join(' ');
};
exports.numberToIndianWords = numberToIndianWords;
//# sourceMappingURL=num-to-words.js.map