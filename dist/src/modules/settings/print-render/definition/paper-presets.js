"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PAPER = exports.findPaperPreset = exports.PAPER_PRESETS = void 0;
exports.PAPER_PRESETS = [
    { code: 'A4', label: 'A4 210 x 297 mm', widthMm: 210, heightMm: 297, layoutMode: 'GRAPHIC' },
    { code: 'A5', label: 'A5 148 x 210 mm', widthMm: 148, heightMm: 210, layoutMode: 'GRAPHIC' },
    { code: 'A6', label: 'A6 105 x 148 mm', widthMm: 105, heightMm: 148, layoutMode: 'GRAPHIC' },
    {
        code: 'LETTER',
        label: 'Letter 216 x 279 mm',
        widthMm: 215.9,
        heightMm: 279.4,
        layoutMode: 'GRAPHIC',
    },
    {
        code: 'T58',
        label: 'Thermal 58 mm roll',
        widthMm: 58,
        heightMm: null,
        layoutMode: 'GRID',
        columns: 32,
    },
    {
        code: 'T80',
        label: 'Thermal 80 mm roll',
        widthMm: 80,
        heightMm: null,
        layoutMode: 'GRID',
        columns: 48,
    },
    {
        code: 'DM80',
        label: 'Dot matrix 80 col (10 CPI)',
        widthMm: 241.3,
        heightMm: 279.4,
        layoutMode: 'GRID',
        columns: 80,
        rows: 66,
        cpi: 10,
    },
    {
        code: 'DM96',
        label: 'Dot matrix 96 col (12 CPI)',
        widthMm: 241.3,
        heightMm: 279.4,
        layoutMode: 'GRID',
        columns: 96,
        rows: 66,
        cpi: 12,
    },
    {
        code: 'DM132',
        label: 'Dot matrix 132 col (10 CPI, 15in)',
        widthMm: 377,
        heightMm: 279.4,
        layoutMode: 'GRID',
        columns: 132,
        rows: 66,
        cpi: 10,
    },
    {
        code: 'DM137',
        label: 'Dot matrix 137 col (15 CPI condensed)',
        widthMm: 241.3,
        heightMm: 279.4,
        layoutMode: 'GRID',
        columns: 137,
        rows: 66,
        cpi: 15,
    },
];
const findPaperPreset = (code) => exports.PAPER_PRESETS.find((preset) => preset.code === (code ?? '').trim().toUpperCase());
exports.findPaperPreset = findPaperPreset;
exports.DEFAULT_PAPER = exports.PAPER_PRESETS[0];
//# sourceMappingURL=paper-presets.js.map