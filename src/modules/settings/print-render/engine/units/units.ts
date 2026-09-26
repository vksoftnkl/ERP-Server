/**
 * Phase 0.1 — the unit system.
 *
 * Every coordinate upstream of a renderer is a millimetre (float). Conversion
 * happens once, at draw time, inside the renderer. Nothing else in the codebase
 * should contain a 2.83465 or a 3.779528.
 *
 * Why millimetres and not points: paper is sold in millimetres, customers
 * describe their stationery in millimetres ("the pre-printed box starts 40mm
 * down"), and every Indian paper size is an exact millimetre figure. Points
 * would put a rounding error between the designer's ruler and the output.
 */

/** PDF user-space units per millimetre: 72 points per inch / 25.4 mm per inch. */
export const POINTS_PER_MM = 72 / 25.4;

/** CSS pixels per millimetre at the 96 DPI the designer canvas assumes. */
export const PIXELS_PER_MM = 96 / 25.4;

export const MM_PER_INCH = 25.4;

export const mmToPoints = (millimetres: number): number => millimetres * POINTS_PER_MM;
export const pointsToMm = (points: number): number => points / POINTS_PER_MM;
export const mmToPixels = (millimetres: number): number => millimetres * PIXELS_PER_MM;
export const pixelsToMm = (pixels: number): number => pixels / PIXELS_PER_MM;
export const mmToInches = (millimetres: number): number => millimetres / MM_PER_INCH;

/**
 * Character cell width in millimetres for a dot-matrix pitch.
 * 10 CPI = 2.54mm per column, 12 CPI = 2.117mm, 15 CPI = 1.693mm.
 */
export const cpiToCellWidthMm = (charactersPerInch: number): number =>
  MM_PER_INCH / charactersPerInch;

/**
 * Lines per inch on dot matrix. 6 LPI is the default draft pitch, which is why
 * a 12-inch fanfold form is 72 lines.
 */
export const lpiToLineHeightMm = (linesPerInch: number): number => MM_PER_INCH / linesPerInch;

/** Round to a tenth of a millimetre — below that no printer can tell. */
export const roundMm = (millimetres: number): number => Math.round(millimetres * 10) / 10;

/**
 * Standard paper geometry. GRID papers carry columns/rows instead of a height,
 * because thermal roll and fanfold are continuous stationery: the printer cuts
 * or feeds, it does not paginate to a fixed sheet.
 */
export interface PaperPreset {
  readonly code: string;
  readonly label: string;
  readonly widthMm: number;
  /** null = continuous stationery. */
  readonly heightMm: number | null;
  readonly layoutMode: 'GRAPHIC' | 'GRID';
  readonly columns?: number;
  readonly rows?: number;
  readonly cpi?: number;
}

export const PAPER_PRESETS: readonly PaperPreset[] = [
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
  // Thermal: 58mm roll prints 48mm, 80mm roll prints 72mm. 32 and 48 columns at
  // font A are the figures every ESC/POS receipt design is built around.
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
  // Dot matrix: the column count is the pitch, not the paper. 80 columns at
  // 10 CPI on 9.5in fanfold; 137 columns needs 15 CPI condensed.
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

const presetsByCode = new Map(PAPER_PRESETS.map((preset) => [preset.code, preset]));

export const findPaperPreset = (code: string): PaperPreset | undefined =>
  presetsByCode.get(code.trim().toUpperCase());
