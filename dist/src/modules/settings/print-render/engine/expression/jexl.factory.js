"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expressionEngine = exports.createExpressionEngine = exports.TRANSFORM_NAMES = void 0;
const jexl = require("jexl");
const format_1 = require("./transforms/format");
const gst_1 = require("./transforms/gst");
const num_to_words_1 = require("./transforms/num-to-words");
const scalar_1 = require("./transforms/scalar");
const text_1 = require("./transforms/text");
exports.TRANSFORM_NAMES = [
    'fmt',
    'fmtIntl',
    'date',
    'numToWords',
    'intToWords',
    'gstSplit',
    'gstExclusive',
    'interState',
    'upper',
    'lower',
    'trim',
    'title',
    'pad',
    'padEnd',
    'padCenter',
    'truncate',
    'repeat',
    'coalesce',
    'wrap',
    'mask',
    'abs',
    'round',
    'ceil',
    'floor',
    'neg',
    'default',
    'length',
    'join',
    'first',
    'last',
    'sum',
    'sortBy',
    'where',
    'groupIndian',
    'groupWestern',
    'bool',
    'num',
    'str',
];
const toNumber = (value) => {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};
const asArray = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const createExpressionEngine = () => {
    const engine = new jexl.Jexl();
    engine.addTransform('fmt', (value, pattern) => (0, format_1.formatNumber)(value, pattern ?? '0.00'));
    engine.addTransform('fmtIntl', (value, pattern) => (0, format_1.formatNumberIntl)(value, pattern ?? '0.00'));
    engine.addTransform('date', (value, pattern) => (0, format_1.formatDate)(value, pattern ?? 'dd-MM-yyyy'));
    engine.addTransform('groupIndian', (value) => (0, format_1.groupIndian)((0, scalar_1.scalarToString)(value)));
    engine.addTransform('groupWestern', (value) => (0, format_1.groupWestern)((0, scalar_1.scalarToString)(value)));
    engine.addTransform('numToWords', (value, currency, subCurrency) => (0, num_to_words_1.numberToIndianWords)(value, {
        currency: currency ?? 'Rupees',
        subCurrency: subCurrency ?? 'Paise',
    }));
    engine.addTransform('intToWords', (value) => (0, num_to_words_1.integerToIndianWords)(toNumber(value)));
    engine.addTransform('gstSplit', (value, rate, interState) => (0, gst_1.gstSplit)(value, rate, interState));
    engine.addTransform('gstExclusive', (value, rate) => (0, gst_1.gstExclusive)(value, rate));
    engine.addTransform('interState', (supplier, recipient) => (0, gst_1.isInterState)(supplier, recipient));
    engine.addTransform('upper', text_1.upper);
    engine.addTransform('lower', text_1.lower);
    engine.addTransform('trim', text_1.trim);
    engine.addTransform('title', text_1.titleCase);
    engine.addTransform('pad', (value, width, fill) => (0, text_1.padStart)(value, toNumber(width), fill));
    engine.addTransform('padEnd', (value, width, fill) => (0, text_1.padEnd)(value, toNumber(width), fill));
    engine.addTransform('padCenter', (value, width, fill) => (0, text_1.padCenter)(value, toNumber(width), fill));
    engine.addTransform('truncate', (value, width, ellipsis) => (0, text_1.truncate)(value, toNumber(width), ellipsis));
    engine.addTransform('repeat', (value, count) => (0, text_1.repeat)(value, toNumber(count)));
    engine.addTransform('coalesce', (value, ...fallbacks) => (0, text_1.coalesce)(value, ...fallbacks));
    engine.addTransform('wrap', (value, width) => (0, text_1.wrapText)(value, toNumber(width)));
    engine.addTransform('mask', (value, visible, maskChar) => (0, text_1.mask)(value, visible === undefined ? 4 : toNumber(visible), maskChar));
    engine.addTransform('abs', (value) => Math.abs(toNumber(value)));
    engine.addTransform('neg', (value) => -toNumber(value));
    engine.addTransform('round', (value, decimals) => {
        const scale = 10 ** Math.max(0, Math.trunc(toNumber(decimals)));
        return Math.round(toNumber(value) * scale) / scale;
    });
    engine.addTransform('ceil', (value) => Math.ceil(toNumber(value)));
    engine.addTransform('floor', (value) => Math.floor(toNumber(value)));
    engine.addTransform('num', (value) => toNumber(value));
    engine.addTransform('str', (value) => (0, scalar_1.scalarToString)(value));
    engine.addTransform('bool', (value) => Boolean(value));
    engine.addTransform('length', (value) => Array.isArray(value) ? value.length : (0, scalar_1.scalarToString)(value).length);
    engine.addTransform('join', (value, separator) => asArray(value)
        .map((entry) => (0, scalar_1.scalarToString)(entry))
        .filter(Boolean)
        .join(separator ?? ', '));
    engine.addTransform('first', (value) => asArray(value)[0] ?? null);
    engine.addTransform('last', (value) => asArray(value).slice(-1)[0] ?? null);
    engine.addTransform('sum', (value, field) => asArray(value).reduce((total, entry) => {
        if (field && entry && typeof entry === 'object') {
            return total + toNumber(entry[field]);
        }
        return total + toNumber(entry);
    }, 0));
    engine.addTransform('sortBy', (value, field) => {
        const rows = [...asArray(value)];
        if (!field) {
            return rows.sort();
        }
        return rows.sort((left, right) => {
            const leftValue = left?.[field];
            const rightValue = right?.[field];
            if (typeof leftValue === 'number' && typeof rightValue === 'number') {
                return leftValue - rightValue;
            }
            return (0, scalar_1.scalarToString)(leftValue).localeCompare((0, scalar_1.scalarToString)(rightValue));
        });
    });
    engine.addTransform('where', (value, field, expected) => asArray(value).filter((entry) => {
        if (!field || !entry || typeof entry !== 'object') {
            return Boolean(entry);
        }
        return entry[field] === expected;
    }));
    engine.addTransform('default', (value, fallback) => value === null || value === undefined || value === '' ? (fallback ?? '') : value);
    return engine;
};
exports.createExpressionEngine = createExpressionEngine;
exports.expressionEngine = (0, exports.createExpressionEngine)();
//# sourceMappingURL=jexl.factory.js.map