/**
 * Sticker printing S-P1 (STK-06, decision 39) — dot maths for the label path.
 *
 * A thermal label printer has a fixed grid of dots (203, 300 or 600 per inch).
 * A barcode bar that is 2.6 dots wide is printed as 2 or 3 dots depending on
 * where it falls, so the narrow and wide bars of one symbol come out unequal
 * and a scanner refuses it. Everything here therefore works in WHOLE dots and
 * only converts to millimetres at the end:
 *
 *   - the page is a whole number of dots, so Qt's raster scale is exactly
 *     dpi / 72 (the PDF is in points);
 *   - every cell origin and every barcode's left edge sits on a dot;
 *   - every bar and space is `modules × moduleDots` dots.
 *
 * Pure: no Nest, no PDFKit. The renderer draws what this returns.
 */

export const MM_PER_INCH = 25.4;

/** The dpi a label design may snap to (ck_ptv_label_sheet). */
export const LABEL_DPIS = [203, 300, 600] as const;

/** The narrow bar in dots, as the designer offers it (1-10). */
export const MODULE_DOTS_MIN = 1;
export const MODULE_DOTS_MAX = 10;

/** A dpi Qt may report (a driver's own figure) — anything sane is accepted. */
export function isUsableDpi(dpi: number | null | undefined): dpi is number {
  return typeof dpi === 'number' && Number.isFinite(dpi) && dpi >= 72 && dpi <= 2400;
}

export function mmToDots(mm: number, dpi: number): number {
  return (mm * dpi) / MM_PER_INCH;
}

export function dotsToMm(dots: number, dpi: number): number {
  return (dots * MM_PER_INCH) / dpi;
}

/** PDF points for a whole number of dots: exactly 72 / dpi each. */
export function dotsToPoints(dots: number, dpi: number): number {
  return (dots * 72) / dpi;
}

/** The nearest whole dot, as millimetres. */
export function snapMmToDot(mm: number, dpi: number): number {
  return dotsToMm(Math.round(mmToDots(mm, dpi)), dpi);
}

/** The narrow bar's width in mm — the designer's "0.375 mm = 3 dots" readout. */
export function moduleWidthMm(moduleDots: number, dpi: number): number {
  return dotsToMm(moduleDots, dpi);
}

export interface PageInDots {
  readonly widthDots: number;
  readonly heightDots: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly widthPt: number;
  readonly heightPt: number;
}

/** A page sized to whole dots (at least one each way). */
export function pageInWholeDots(widthMm: number, heightMm: number, dpi: number): PageInDots {
  const widthDots = Math.max(1, Math.round(mmToDots(widthMm, dpi)));
  const heightDots = Math.max(1, Math.round(mmToDots(heightMm, dpi)));
  return {
    widthDots,
    heightDots,
    widthMm: dotsToMm(widthDots, dpi),
    heightMm: dotsToMm(heightDots, dpi),
    widthPt: dotsToPoints(widthDots, dpi),
    heightPt: dotsToPoints(heightDots, dpi),
  };
}

export interface SnappedBar {
  /** Left edge, mm from the label origin (a whole dot). */
  readonly xMm: number;
  readonly widthMm: number;
  readonly xDots: number;
  readonly widthDots: number;
}

export interface SnappedBars {
  /** The left edge actually used (the element's x snapped to a dot). */
  readonly leftMm: number;
  readonly leftDots: number;
  readonly bars: readonly SnappedBar[];
  /** The whole symbol, first bar to last bar. */
  readonly widthMm: number;
  readonly widthDots: number;
}

/**
 * A bwip-js `sbs` pattern (bar, space, bar, … in modules) laid out on dots.
 *
 * `moduleDots` is the narrow bar; a wide bar of 3 modules is exactly three
 * times it. The left edge is rounded to the nearest dot, and from there every
 * edge is an integer — no bar ever straddles two dots.
 */
export function layoutBars(
  sbs: readonly number[],
  moduleDots: number,
  dpi: number,
  leftMm: number,
): SnappedBars {
  const dotsPerModule = Math.max(
    MODULE_DOTS_MIN,
    Math.min(MODULE_DOTS_MAX, Math.round(moduleDots)),
  );
  const leftDots = Math.round(mmToDots(leftMm, dpi));
  const bars: SnappedBar[] = [];
  let cursor = leftDots;
  sbs.forEach((modules, index) => {
    const widthDots = Math.max(1, Math.round(modules)) * dotsPerModule;
    if (index % 2 === 0) {
      bars.push({
        xDots: cursor,
        widthDots,
        xMm: dotsToMm(cursor, dpi),
        widthMm: dotsToMm(widthDots, dpi),
      });
    }
    cursor += widthDots;
  });
  const widthDots = cursor - leftDots;
  return {
    leftMm: dotsToMm(leftDots, dpi),
    leftDots,
    bars,
    widthMm: dotsToMm(widthDots, dpi),
    widthDots,
  };
}
