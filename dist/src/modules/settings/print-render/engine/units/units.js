"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findPaperPreset = exports.PAPER_PRESETS = exports.roundMm = exports.lpiToLineHeightMm = exports.cpiToCellWidthMm = exports.mmToInches = exports.pixelsToMm = exports.mmToPixels = exports.pointsToMm = exports.mmToPoints = exports.MM_PER_INCH = exports.PIXELS_PER_MM = exports.POINTS_PER_MM = void 0;
exports.POINTS_PER_MM = 72 / 25.4;
exports.PIXELS_PER_MM = 96 / 25.4;
exports.MM_PER_INCH = 25.4;
const mmToPoints = (millimetres) => millimetres * exports.POINTS_PER_MM;
exports.mmToPoints = mmToPoints;
const pointsToMm = (points) => points / exports.POINTS_PER_MM;
exports.pointsToMm = pointsToMm;
const mmToPixels = (millimetres) => millimetres * exports.PIXELS_PER_MM;
exports.mmToPixels = mmToPixels;
const pixelsToMm = (pixels) => pixels / exports.PIXELS_PER_MM;
exports.pixelsToMm = pixelsToMm;
const mmToInches = (millimetres) => millimetres / exports.MM_PER_INCH;
exports.mmToInches = mmToInches;
const cpiToCellWidthMm = (charactersPerInch) => exports.MM_PER_INCH / charactersPerInch;
exports.cpiToCellWidthMm = cpiToCellWidthMm;
const lpiToLineHeightMm = (linesPerInch) => exports.MM_PER_INCH / linesPerInch;
exports.lpiToLineHeightMm = lpiToLineHeightMm;
const roundMm = (millimetres) => Math.round(millimetres * 10) / 10;
exports.roundMm = roundMm;
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
const presetsByCode = new Map(exports.PAPER_PRESETS.map((preset) => [preset.code, preset]));
const findPaperPreset = (code) => presetsByCode.get(code.trim().toUpperCase());
exports.findPaperPreset = findPaperPreset;
//# sourceMappingURL=units.js.map