import { findPaperPreset } from '../../definition/paper-presets';
import { PageInDots, dotsToMm, mmToDots, pageInWholeDots } from './bar-snap';

/**
 * Sticker printing S-P1 (STK-02 / 03 / 34, plan §4.1 / §4.4) — label imposition.
 *
 * A label design describes ONE label as a person reads it (w × h) and a
 * "label sheet": how many sit across, how many down, the gaps, the side
 * margin and how the label is turned on the liner. This file works out the
 * page from that, and where each label of a run lands:
 *
 *   - cells run across, then down; the next row of the run continues in the
 *     free cells of the same page (3.0's "row 4: Oil + Rice");
 *   - on a SHEET (labels down > 1) the first page starts at cell `startAt`;
 *     on a roll it is always cell 1 (decision 35);
 *   - the last page's unused cells stay blank;
 *   - every cell origin is on a whole printer dot (decision 39).
 *
 * Pure: the label path in PrintRenderService calls it, and so do the tests.
 */

export type LabelRotate = 0 | 90 | 180 | 270;

export const LABEL_ROTATES: readonly LabelRotate[] = [0, 90, 180, 270];

/** The paper a label design prints on: a roll, or an A4 sheet of labels. */
export const LABEL_PAPER_CODES = ['LABEL', 'A4'] as const;

export interface LabelSheetSpec {
  readonly labelWidthMm: number;
  readonly labelHeightMm: number;
  readonly across: number;
  readonly down: number;
  readonly gapXMm: number;
  readonly gapYMm: number;
  readonly rotate: LabelRotate;
  /** LABEL (a roll) or A4 (a sheet). */
  readonly paperCode: string;
  /** "Side": the left margin; the right one equals it on a LABEL roll. */
  readonly marginLeftMm: number;
  readonly marginTopMm: number;
  readonly marginRightMm: number;
  readonly marginBottomMm: number;
  /** The design's snap dpi (ptv_label_dpi). */
  readonly dpi: number;
}

/** One label's footprint on the liner: w × h, or h × w when turned a quarter. */
export function cellSize(spec: Pick<LabelSheetSpec, 'labelWidthMm' | 'labelHeightMm' | 'rotate'>): {
  widthMm: number;
  heightMm: number;
} {
  return spec.rotate === 90 || spec.rotate === 270
    ? { widthMm: spec.labelHeightMm, heightMm: spec.labelWidthMm }
    : { widthMm: spec.labelWidthMm, heightMm: spec.labelHeightMm };
}

export function isSheet(spec: Pick<LabelSheetSpec, 'down'>): boolean {
  return spec.down > 1;
}

export function cellsPerPage(spec: Pick<LabelSheetSpec, 'across' | 'down'>): number {
  return Math.max(1, spec.across) * Math.max(1, spec.down);
}

/** Round to the 2 dp the numeric(8,2) page columns hold. */
const twoDp = (value: number): number => Math.round(value * 100) / 100;

/**
 * The page, worked out (plan §4.1), in millimetres.
 *
 * LABEL paper: 2 × side + across × cell w + (across − 1) × gap across wide, and
 * down × cell h + (down − 1) × gap down + top + bottom high. Any other paper
 * (A4) is its preset size; the labels start at the left / top margins.
 * Example: 50 × 25, 2 across, gap 2, side 1 → 104 × 25 mm.
 */
export function workedOutPage(spec: LabelSheetSpec): { widthMm: number; heightMm: number } {
  if (spec.paperCode.trim().toUpperCase() === 'LABEL') {
    const cell = cellSize(spec);
    return {
      widthMm: twoDp(
        2 * spec.marginLeftMm + spec.across * cell.widthMm + (spec.across - 1) * spec.gapXMm,
      ),
      heightMm: twoDp(
        spec.down * cell.heightMm +
          (spec.down - 1) * spec.gapYMm +
          spec.marginTopMm +
          spec.marginBottomMm,
      ),
    };
  }
  const preset = findPaperPreset(spec.paperCode) ?? findPaperPreset('A4');
  return { widthMm: preset?.widthMm ?? 210, heightMm: preset?.heightMm ?? 297 };
}

/**
 * The top-left of cell `cellIndex` (0-based, across then down), on a whole dot.
 * The vertical gap is on the page only for a sheet (decision 38): a roll's gap
 * is the printer's gap sensor, not white space in the PDF.
 */
export function cellOrigin(
  spec: LabelSheetSpec,
  cellIndex: number,
  dpi: number,
): { xMm: number; yMm: number } {
  const cell = cellSize(spec);
  const across = Math.max(1, spec.across);
  const column = cellIndex % across;
  const row = Math.floor(cellIndex / across);
  const gapY = isSheet(spec) ? spec.gapYMm : 0;
  const xMm = spec.marginLeftMm + column * (cell.widthMm + spec.gapXMm);
  const yMm = spec.marginTopMm + row * (cell.heightMm + gapY);
  return {
    xMm: dotsToMm(Math.round(mmToDots(xMm, dpi)), dpi),
    yMm: dotsToMm(Math.round(mmToDots(yMm, dpi)), dpi),
  };
}

/**
 * How a label drawn in its own w × h space is put into its cell: translate,
 * then turn clockwise (PDF user space, y down). The cell is h × w at 90 / 270.
 *
 * `dpi` is the PRINT dpi the origins were snapped to. A turned label is
 * translated to the cell's far edge (origin + cell width / height), and that
 * sum is snapped to a whole dot as well: 50 mm at 203 dpi is 399.6 dots, so
 * without it every edge of a 180° / 270° label sat a fixed fraction of a dot
 * off the grid (review NIT10). The origin itself is already on a dot.
 */
export function cellTransform(
  spec: Pick<LabelSheetSpec, 'labelWidthMm' | 'labelHeightMm' | 'rotate'>,
  origin: { xMm: number; yMm: number },
  dpi: number,
): { translateXMm: number; translateYMm: number; rotate: LabelRotate } {
  const cell = cellSize(spec);
  const onDot = (mm: number): number => dotsToMm(Math.round(mmToDots(mm, dpi)), dpi);
  switch (spec.rotate) {
    case 90:
      return { translateXMm: onDot(origin.xMm + cell.widthMm), translateYMm: origin.yMm, rotate: 90 };
    case 180:
      return {
        translateXMm: onDot(origin.xMm + cell.widthMm),
        translateYMm: onDot(origin.yMm + cell.heightMm),
        rotate: 180,
      };
    case 270:
      return { translateXMm: origin.xMm, translateYMm: onDot(origin.yMm + cell.heightMm), rotate: 270 };
    default:
      return { translateXMm: origin.xMm, translateYMm: origin.yMm, rotate: 0 };
  }
}

/** One label placed on a page. */
export interface PlacedLabel {
  /** Which input row (0-based) this label prints. */
  readonly rowIndex: number;
  /** Which copy of that row (0-based): copy_no − 1. */
  readonly copyIndex: number;
  /** 0-based cell on the page, across then down. */
  readonly cellIndex: number;
  readonly xMm: number;
  readonly yMm: number;
}

export interface ImposedRun {
  readonly page: PageInDots;
  readonly pages: readonly (readonly PlacedLabel[])[];
  readonly labelCount: number;
  /** The start cell actually used (1 on a roll; clamped to the page on a sheet). */
  readonly startAt: number;
}

/** `startAt` as the run uses it: 1 on a roll, 1..cells on a sheet. */
export function effectiveStartAt(spec: LabelSheetSpec, startAt: number | null | undefined): number {
  if (!isSheet(spec)) {
    return 1;
  }
  const requested = Number.isFinite(startAt) ? Math.trunc(startAt as number) : 1;
  return Math.max(1, Math.min(cellsPerPage(spec), requested));
}

/**
 * Place `counts[i]` labels of row i, in order, across then down, page after
 * page. `dpi` is the PRINT dpi (the printer's own when Qt reports it, else the
 * design's): the page and the cell origins are whole dots of it.
 */
export function impose(
  spec: LabelSheetSpec,
  counts: readonly number[],
  options: { startAt?: number | null; dpi: number },
): ImposedRun {
  const page = workedOutPage(spec);
  const pageDots = pageInWholeDots(page.widthMm, page.heightMm, options.dpi);
  const perPage = cellsPerPage(spec);
  const startAt = effectiveStartAt(spec, options.startAt);

  const origins = Array.from({ length: perPage }, (_unused, index) =>
    cellOrigin(spec, index, options.dpi),
  );

  const pages: PlacedLabel[][] = [];
  let current: PlacedLabel[] = [];
  let cell = startAt - 1;
  let labelCount = 0;

  counts.forEach((count, rowIndex) => {
    const labels = Math.max(0, Math.trunc(count));
    for (let copyIndex = 0; copyIndex < labels; copyIndex += 1) {
      if (cell >= perPage) {
        pages.push(current);
        current = [];
        cell = 0;
      }
      const origin = origins[cell];
      current.push({ rowIndex, copyIndex, cellIndex: cell, xMm: origin.xMm, yMm: origin.yMm });
      cell += 1;
      labelCount += 1;
    }
  });
  if (current.length > 0) {
    pages.push(current);
  }

  return { page: pageDots, pages, labelCount, startAt };
}
