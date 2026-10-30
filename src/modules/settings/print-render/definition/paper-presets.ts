/**
 * The papers the product knows by name.
 *
 * `ptv_paper_code` is a free-form VARCHAR(20) and `ptv_width_mm` / `ptv_height_mm`
 * are NULLABLE, so a version may name its paper and say nothing about its size.
 * This table is what fills that in. A site's own code that matches nothing here
 * keeps its name and must carry its own dimensions — silently renaming it to A4
 * would be a lie, and guessing its width would print off the edge of the form.
 *
 * The mirror image of `ERP client/features/print-designer/lib/vocabulary.ts`,
 * whose comment already calls itself a mirror of a server table that had not
 * been written. This is that table.
 */

export interface PaperPreset {
  readonly code: string;
  readonly label: string;
  readonly widthMm: number;
  /** null = continuous stationery: a thermal roll, or fanfold cut by form length. */
  readonly heightMm: number | null;
  readonly layoutMode: 'GRAPHIC' | 'GRID';
  /** GRID only: printable character columns. */
  readonly columns?: number;
  /** GRID only: lines per form. */
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

export const findPaperPreset = (code: string | null | undefined): PaperPreset | undefined =>
  PAPER_PRESETS.find((preset) => preset.code === (code ?? '').trim().toUpperCase());

/** The fallback when a version names a paper nothing knows and gives no size. */
export const DEFAULT_PAPER: PaperPreset = PAPER_PRESETS[0];
