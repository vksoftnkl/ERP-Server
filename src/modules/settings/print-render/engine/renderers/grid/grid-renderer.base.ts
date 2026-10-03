import { Logger } from '@nestjs/common';
import { LayoutPage, LayoutTree, Primitive, TextPrimitive } from '../../layout/layout-tree.types';
import { PrinterCommandProfile } from '../renderer.types';
import { Codepage, findUnprintableScripts, getCodepage } from './codepage';
import { CellStyle, DEFAULT_STYLE, GridCanvas } from './grid-canvas';

/**
 * Shared LayoutTree -> GridCanvas conversion for the raw renderers.
 *
 * ── Why GRID is a first-class path, not a degraded GRAPHIC one ───────────────
 * Sending a rasterised page to a dot-matrix printer is unusably slow: a 50-line
 * invoice in graphics mode takes the better part of a minute, and a kirana
 * wholesaler prints a hundred a day. Tally and Marg are fast on these printers
 * because they send raw draft-mode TEXT — the printer's own ROM does the glyph
 * rendering, and the head makes one pass per line. Matching that is the point
 * of this path.
 *
 * So a GRID template's coordinates are integer character cells, and the whole
 * concept of a millimetre is absent. The layout engine already produced the tree
 * that way; this class only has to place characters.
 */

export interface GridConversion {
  readonly canvas: GridCanvas;
  readonly warnings: readonly string[];
}

export abstract class GridRendererBase {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Turn one layout page into a character matrix.
   *
   * Primitives arrive in the order the layout engine emitted them, which is
   * ascending z within each band. GridCanvas.write overwrites, so that order is
   * exactly what makes a label drawn over a rule replace its dashes.
   */
  protected toCanvas(page: LayoutPage, columns: number, codepage: Codepage): GridConversion {
    const canvas = new GridCanvas(columns);
    const warnings = new Set<string>();
    const unmappedCharacters = new Set<string>();
    const unprintableScripts = new Set<string>();

    for (const primitive of page.primitives) {
      switch (primitive.k) {
        case 'text':
          this.writeText(canvas, primitive, codepage, unmappedCharacters, unprintableScripts);
          break;

        case 'line': {
          // A horizontal rule becomes a run of the template's gridChar. A
          // vertical one becomes a column of '|'.
          const isHorizontal = Math.round(primitive.y1) === Math.round(primitive.y2);
          if (isHorizontal) {
            canvas.fillRow(primitive.y1, primitive.x1, primitive.x2, primitive.gridChar);
          } else {
            canvas.fillColumn(primitive.x1, primitive.y1, primitive.y2, '|');
          }
          break;
        }

        case 'rect':
          this.writeRect(canvas, primitive);
          break;

        case 'image':
        case 'barcode':
        case 'qrcode':
          // Graphics in a text-mode stream. The ESC/POS renderer overrides
          // this to raster a logo; the ESC/P one deliberately does not, because
          // graphics mode is the slowness this path exists to avoid.
          this.onGraphicPrimitive(primitive, warnings);
          break;

        default:
          break;
      }
    }

    if (unmappedCharacters.size > 0) {
      warnings.add(
        `${unmappedCharacters.size} character(s) have no representation in code page ` +
          `${codepage.name} and printed as '?': ${[...unmappedCharacters].slice(0, 20).join(' ')}`,
      );
    }

    if (unprintableScripts.size > 0) {
      // A distinct warning, because the remedy is different: not another code
      // page, but the PDF path. A printer's ROM has no complex-script glyphs at
      // any setting.
      warnings.add(
        `${[...unprintableScripts].join(', ')} text cannot be printed in text mode on this ` +
          'printer — a character ROM has no glyphs for it. Use a PDF template for ' +
          'this document, or keep the template in English/transliterated text.',
      );
    }

    const clipped = canvas.clipped;
    if (clipped.columns > 0) {
      warnings.add(
        `${clipped.columns} field(s) ran past the ${columns}-column budget and were clipped`,
      );
    }
    if (clipped.rows > 0) {
      warnings.add(`${clipped.rows} field(s) fell outside the printable rows and were dropped`);
    }

    return { canvas, warnings: [...warnings] };
  }

  private writeText(
    canvas: GridCanvas,
    primitive: TextPrimitive,
    codepage: Codepage,
    unmappedCharacters: Set<string>,
    unprintableScripts: Set<string>,
  ): void {
    const style = this.styleFor(primitive);
    const lines = primitive.lines.length > 0 ? primitive.lines : [primitive.text];
    // In GRID mode `w` is a column count, not millimetres.
    const width = primitive.w > 0 ? Math.round(primitive.w) : undefined;

    lines.forEach((line, index) => {
      if (!line) {
        return;
      }

      // Transliterate BEFORE measuring: '₹' becomes 'Rs.', three cells wide,
      // and a grid measured against the original would misalign every column
      // to its right.
      const prepared = Codepage.prepare(line);

      for (const script of findUnprintableScripts(prepared)) {
        unprintableScripts.add(script);
      }
      for (const character of codepage.encode(prepared).unmapped) {
        unmappedCharacters.add(character);
      }

      const row = Math.round(primitive.y) + index;
      const column = Math.round(primitive.x);

      if (primitive.align === 'right' && width !== undefined) {
        canvas.writeRight(row, column + width, prepared, style);
      } else if (primitive.align === 'center' && width !== undefined) {
        canvas.writeCentered(row, column, width, prepared, style);
      } else {
        canvas.write(row, column, prepared, style, width);
      }
    });
  }

  /**
   * A RECT becomes an ASCII box.
   *
   * Only its border, never a fill: a filled rectangle on a dot matrix means
   * printing a solid block of characters, which is slow, loud, and consumes
   * ribbon for no information. A filled RECT in a GRID template is almost
   * always a designer habit carried over from the PDF template.
   */
  private writeRect(canvas: GridCanvas, primitive: Extract<Primitive, { k: 'rect' }>): void {
    const top = Math.round(primitive.y);
    const left = Math.round(primitive.x);
    const bottom = top + Math.max(1, Math.round(primitive.h));
    const right = left + Math.max(1, Math.round(primitive.w));

    canvas.fillRow(top, left, right, '-');
    canvas.fillRow(bottom, left, right, '-');
    canvas.fillColumn(left, top, bottom, '|');
    canvas.fillColumn(right, top, bottom, '|');
    canvas.write(top, left, '+');
    canvas.write(top, right, '+');
    canvas.write(bottom, left, '+');
    canvas.write(bottom, right, '+');
  }

  /** Map a text primitive's font onto the printer's coarse style switches. */
  protected styleFor(primitive: TextPrimitive): CellStyle {
    return {
      ...DEFAULT_STYLE,
      bold: primitive.font.bold,
      underline: primitive.font.underline,
      // A printer has no point sizes. Anything meaningfully larger than the
      // template's body text becomes double-width/height, which is the only
      // enlargement the hardware offers.
      doubleWidth: primitive.font.sizePt >= 14,
      doubleHeight: primitive.font.sizePt >= 14,
      centered: primitive.align === 'center',
    };
  }

  /** Subclass hook for image/barcode/QR primitives. */
  protected abstract onGraphicPrimitive(primitive: Primitive, warnings: Set<string>): void;

  /**
   * Column budget: the printer profile wins over the template's paper.
   *
   * A template authored for 80 columns must not silently print 80 columns of an
   * invoice onto a 58mm thermal roll that can only show 32 — the profile
   * describes the hardware actually attached.
   */
  protected resolveColumns(
    tree: LayoutTree,
    profile: PrinterCommandProfile | null | undefined,
  ): number {
    const fromProfile = profile?.columns;
    const fromPaper = tree.paper.columns;
    return fromProfile ?? fromPaper ?? this.defaultColumns();
  }

  protected resolveCodepage(profile: PrinterCommandProfile | null | undefined): Codepage {
    return getCodepage(profile?.codepage);
  }

  protected abstract defaultColumns(): number;
}
