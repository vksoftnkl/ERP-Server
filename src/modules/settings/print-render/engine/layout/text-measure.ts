import { Injectable } from '@nestjs/common';
import { FontRegistry, LoadedFont } from '../fonts/font.registry';
import { ScriptRun, splitScriptRuns } from '../fonts/script-runs';
import { POINTS_PER_MM, pointsToMm } from '../units/units';

/**
 * Font metrics for the layout engine.
 *
 * The contract with the PDF renderer is exact: this class must report the width
 * the renderer will actually draw. Any drift shows up as the classic report bug
 * where a wrapped column creeps one character further right on every page, or
 * where autoGrow reserves four lines for text that draws as five and the next
 * band overprints it.
 *
 * That is why measurement goes through the SAME FontRegistry, the SAME script
 * splitting, and fontkit's SAME `layout()` call that produces the glyphs the
 * renderer embeds. It is not an approximation of the renderer; it is the
 * renderer's own measurement, taken early.
 */

export interface MeasuredFont {
  readonly family: string;
  readonly sizePt: number;
  readonly bold: boolean;
  readonly italic: boolean;
}

export interface WrappedText {
  readonly lines: readonly string[];
  /** Width of the widest line, millimetres. */
  readonly widthMm: number;
  /** Total height of all lines including leading, millimetres. */
  readonly heightMm: number;
  /** Height of one line including leading, millimetres. */
  readonly lineHeightMm: number;
}

/**
 * Multiplier applied to the font's own ascent+descent+lineGap.
 *
 * Noto's metrics are generous — its natural line height is around 1.36em, which
 * on a dense invoice grid wastes a third of the page. 1.0 uses the font's own
 * figure; the engine's default band leading is applied on top by the caller.
 */
const LINE_HEIGHT_FACTOR = 1.0;

@Injectable()
export class TextMeasurer {
  /**
   * Widths are cached per (face, size, text). A DETAIL band measures the same
   * column headers and the same repeated unit strings on every one of 500 rows;
   * without the cache that is 500 fontkit layouts of the word 'PCS'.
   */
  private readonly widthCache = new Map<string, number>();

  constructor(private readonly fonts: FontRegistry) {}

  /** Advance width of a string in millimetres, with per-script font fallback. */
  measureWidthMm(text: string, font: MeasuredFont): number {
    if (!text) {
      return 0;
    }

    const cacheKey = `${font.family}|${font.bold ? 1 : 0}${font.italic ? 1 : 0}|${font.sizePt}|${text}`;
    const cached = this.widthCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let totalPoints = 0;
    for (const run of splitScriptRuns(text)) {
      totalPoints += this.measureRunPoints(run, font);
    }

    const millimetres = pointsToMm(totalPoints);

    // Bound the cache. A report with thousands of distinct item names would
    // otherwise grow it without limit across a long-lived process.
    if (this.widthCache.size < 50_000) {
      this.widthCache.set(cacheKey, millimetres);
    }

    return millimetres;
  }

  /** Height of one line in millimetres, from the face's own vertical metrics. */
  lineHeightMm(font: MeasuredFont): number {
    const face = this.fonts.resolve({
      family: font.family,
      bold: font.bold,
      italic: font.italic,
    });
    return pointsToMm(this.lineHeightPoints(face, font.sizePt));
  }

  /** Distance from the top of a line box down to the baseline, millimetres. */
  ascentMm(font: MeasuredFont): number {
    const face = this.fonts.resolve({
      family: font.family,
      bold: font.bold,
      italic: font.italic,
    });
    return pointsToMm((face.ascent / face.unitsPerEm) * font.sizePt);
  }

  /**
   * Greedy word wrap to a millimetre width.
   *
   * Greedy rather than Knuth-Plass on purpose: an invoice column is narrow, the
   * text is a product name rather than prose, and a paragraph-optimal break
   * would put the wrap in a different place than the designer's canvas preview
   * showed. Predictability beats typographic quality here.
   */
  wrap(text: string, maxWidthMm: number, font: MeasuredFont): WrappedText {
    const lineHeightMm = this.lineHeightMm(font);

    if (!text) {
      return { lines: [], widthMm: 0, heightMm: 0, lineHeightMm };
    }

    // A zero or negative budget means the caller gave no width. Return one line
    // rather than looping forever trying to break into nothing.
    if (maxWidthMm <= 0) {
      return {
        lines: [text],
        widthMm: this.measureWidthMm(text, font),
        heightMm: lineHeightMm,
        lineHeightMm,
      };
    }

    const lines: string[] = [];

    // Author-supplied newlines are hard breaks. Terms-and-conditions blocks are
    // stored with them and must not be reflowed into one paragraph.
    for (const paragraph of text.split(/\r?\n/)) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }
      lines.push(...this.wrapParagraph(paragraph, maxWidthMm, font));
    }

    const widthMm = lines.reduce(
      (widest, line) => Math.max(widest, this.measureWidthMm(line, font)),
      0,
    );

    return {
      lines,
      widthMm,
      heightMm: lines.length * lineHeightMm,
      lineHeightMm,
    };
  }

  /**
   * Truncate to a width, appending `ellipsis` inside the budget.
   * Binary search rather than character-by-character: an item name is short,
   * but this runs once per cell per row.
   */
  truncateToWidth(text: string, maxWidthMm: number, font: MeasuredFont, ellipsis = '…'): string {
    if (!text || maxWidthMm <= 0) {
      return '';
    }
    if (this.measureWidthMm(text, font) <= maxWidthMm) {
      return text;
    }

    const characters = [...text];
    const ellipsisWidth = this.measureWidthMm(ellipsis, font);
    const budget = maxWidthMm - ellipsisWidth;

    if (budget <= 0) {
      return '';
    }

    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const candidate = characters.slice(0, middle).join('');
      if (this.measureWidthMm(candidate, font) <= budget) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return characters.slice(0, low).join('') + ellipsis;
  }

  /** Discard cached widths. Called when the font registry changes. */
  clearCache(): void {
    this.widthCache.clear();
  }

  private wrapParagraph(paragraph: string, maxWidthMm: number, font: MeasuredFont): string[] {
    const words = paragraph.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;

      if (this.measureWidthMm(candidate, font) <= maxWidthMm) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = '';
      }

      // A single word wider than the column has to be broken mid-word. Letting
      // it overflow would push it across the next column's cell.
      if (this.measureWidthMm(word, font) > maxWidthMm) {
        lines.push(...this.breakLongWord(word, maxWidthMm, font));
        current = lines.pop() ?? '';
      } else {
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [''];
  }

  private breakLongWord(word: string, maxWidthMm: number, font: MeasuredFont): string[] {
    const pieces: string[] = [];
    let current = '';

    for (const character of word) {
      const candidate = current + character;
      if (current && this.measureWidthMm(candidate, font) > maxWidthMm) {
        pieces.push(current);
        current = character;
      } else {
        current = candidate;
      }
    }

    if (current) {
      pieces.push(current);
    }

    return pieces;
  }

  /**
   * Advance width of one single-script run, in points.
   *
   * Uses fontkit's shaping `layout()`, not a sum of per-glyph advances: for
   * Tamil the two differ, because shaping ligates clusters and applies GPOS
   * kerning. Summing cmap advances would over-measure every Tamil string and
   * wrap it early.
   */
  private measureRunPoints(run: ScriptRun, font: MeasuredFont): number {
    const face = this.fonts.resolveForScript(
      { family: font.family, bold: font.bold, italic: font.italic },
      run.script,
    );

    try {
      const laidOut = face.font.layout(run.text);
      return (laidOut.advanceWidth / face.unitsPerEm) * font.sizePt;
    } catch {
      // A face that cannot shape a string still has to yield a number, or the
      // whole render dies over one odd character. Approximate at half an em.
      return [...run.text].length * font.sizePt * 0.5;
    }
  }

  private lineHeightPoints(face: LoadedFont, sizePt: number): number {
    // descent is negative in font units.
    const emHeight = (face.ascent - face.descent + face.lineGap) / face.unitsPerEm;
    return emHeight * sizePt * LINE_HEIGHT_FACTOR;
  }
}

/** Millimetres per point, exposed for renderers that work in points. */
export const MM_PER_POINT = 1 / POINTS_PER_MM;
