import { Injectable, Logger } from '@nestjs/common';
// `import = require()` rather than a namespace or default import: pdfkit is
// CommonJS (`module.exports = PDFDocument`, typed `export =`) and this tsconfig
// sets allowSyntheticDefaultImports WITHOUT esModuleInterop. A namespace import
// typechecks and then yields a non-callable module object under tsx/ESM interop,
// and a default import yields undefined.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PdfDocument = require('pdfkit');
import { LineStyle, OutputMode } from '../../definition/template-definition.schema';
import { FontRegistry, LoadedFont } from '../fonts/font.registry';
import { splitScriptRuns } from '../fonts/script-runs';
import {
  BarcodePrimitive,
  ImagePrimitive,
  LayoutPage,
  LayoutTree,
  LinePrimitive,
  PathPrimitive,
  QrCodePrimitive,
  RectPrimitive,
  RichRun,
  TextPrimitive,
} from '../layout/layout-tree.types';
import { mmToPoints } from '../units/units';
import { BarcodeFactory } from './barcode.factory';
import { ImageCache } from './image.cache';
import { IRenderer, RenderOptions, RenderResult } from './renderer.types';

/**
 * Phase 4 -- the PDF renderer.
 *
 * The primary renderer, on the strength of the Phase 0.2 spike: PDFKit (via
 * fontkit) shapes Tamil correctly -- conjuncts, pulli stacking and
 * left-reordering vowel signs all come out right -- so no Chromium fallback is
 * needed and the 4 GB VPS never has to host a browser.
 *
 * The spike's OTHER finding is what shapes this file: NotoSansTamil has NO
 * Latin coverage. A single-font draw of `Sugar சர்க்கரை 1kg` silently replaces
 * every Latin glyph with a .notdef box. So `drawText` never draws a string in
 * one font -- it splits into script runs, measures each with the face that will
 * draw it, and positions them in sequence. That is the whole reason this
 * renderer does its own text positioning rather than handing strings to
 * PDFKit's own layout.
 */

/** Millimetres of slack allowed before a primitive is reported as off-page. */
const OVERFLOW_TOLERANCE_MM = 0.5;

/**
 * Dash patterns in multiples of the line width (never below 1pt, or a 0.5pt
 * dotted frame becomes a grey smear). The names are QtRPT's pen styles.
 */
const DASH_PATTERNS: Record<Exclude<LineStyle, 'SOLID' | 'DOUBLE'>, number[]> = {
  DASH: [4, 2],
  DOT: [1, 1],
  DASH_DOT: [4, 2, 1, 2],
  DASH_DOT_DOT: [4, 2, 1, 2, 1, 2],
};

/** DOUBLE: two strokes of the line width, this far apart centre to centre. */
const doubleGapPt = (widthPt: number): number => widthPt * 2 + 1;

/** One drawable stretch of a text line: a script run in one face and style. */
interface TextPiece {
  readonly text: string;
  readonly face: LoadedFont;
  readonly sizePt: number;
  readonly color: string;
  readonly widthPt: number;
  readonly underline: boolean;
  readonly strikeout: boolean;
  readonly shift?: 'sup' | 'sub';
  /** Ascent of the run's primary (Latin) face, for baseline alignment. */
  readonly ascentPt: number;
}

@Injectable()
export class PdfKitRenderer implements IRenderer {
  readonly outputMode: OutputMode = 'PDF';

  private readonly logger = new Logger(PdfKitRenderer.name);

  constructor(
    private readonly fonts: FontRegistry,
    private readonly barcodes: BarcodeFactory,
    private readonly images: ImageCache,
  ) {}

  async render(tree: LayoutTree, options: RenderOptions = {}): Promise<RenderResult> {
    const startedAt = Date.now();
    const warnings: string[] = tree.warnings.map(
      (warning) =>
        `${warning.kind}: ${warning.message}${warning.detail ? ` (${warning.detail})` : ''}`,
    );

    // Continuous stationery has no page height. A PDF must have one, so the
    // page grows to fit its content -- which is what a thermal PDF preview
    // should look like anyway.
    const heightMm = tree.paper.heightMm ?? this.contentHeightMm(tree);

    const document = new PdfDocument({
      size: [mmToPoints(tree.paper.widthMm), mmToPoints(heightMm)],
      margin: 0,
      autoFirstPage: false,
      // Compression matters on a 4 GB VPS serving a 200-page statement.
      compress: true,
      info: {
        Producer: 'VK Nex ERP',
        Creator: 'VK Nex ERP report engine',
        // Explicit, because PDFKit derives the trailer /ID from
        // md5(CreationDate + info). Left to default it takes `new Date()`, and
        // that one field is the only thing that makes two renders of identical
        // input differ.
        CreationDate: options.creationDate ?? new Date(),
      },
    });

    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>((resolveFinished, rejectFinished) => {
      document.on('end', () => resolveFinished());
      document.on('error', rejectFinished);
    });

    this.registerFonts(document);

    // Barcodes, QR codes and images are async. Resolving them per page BEFORE
    // drawing keeps the drawing loop synchronous, which matters because PDFKit's
    // graphics state is a mutable cursor: an await between a fillColor and the
    // draw it applies to is a colour bleeding into an unrelated primitive.
    for (const page of tree.pages) {
      const assets = await this.prepareAssets(page, options);
      document.addPage({
        size: [mmToPoints(tree.paper.widthMm), mmToPoints(heightMm)],
        margin: 0,
      });
      this.drawPage(document, page, assets, tree.paper.widthMm, heightMm, warnings);
    }

    document.end();
    await finished;

    warnings.push(...this.barcodes.drainWarnings(), ...this.images.drainWarnings());

    const bytes = Buffer.concat(chunks);
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `PDF rendered: ${tree.pageCount} page(s), ${(bytes.length / 1024).toFixed(0)}KB, ${durationMs}ms`,
    );

    return {
      bytes,
      contentType: 'application/pdf',
      extension: 'pdf',
      pageCount: tree.pageCount,
      durationMs,
      warnings,
    };
  }

  // ─── Setup ─────────────────────────────────────────────────────────────

  /**
   * Register every loaded face once, up front.
   *
   * PDFKit subsets on embed, so registering all eight costs nothing in output
   * size for the faces a document never uses -- and registering lazily would
   * mean a mid-page registerFont call, which is a needless hazard.
   */
  private registerFonts(document: PDFKit.PDFDocument): void {
    for (const face of this.fonts.all()) {
      document.registerFont(face.id, face.filePath);
    }
  }

  private contentHeightMm(tree: LayoutTree): number {
    let lowest = 0;
    for (const page of tree.pages) {
      for (const primitive of page.primitives) {
        switch (primitive.k) {
          case 'text':
            lowest = Math.max(
              lowest,
              primitive.y + Math.max(primitive.h, primitive.lines.length * primitive.lineHeightMm),
            );
            break;
          case 'line':
            lowest = Math.max(lowest, primitive.y1, primitive.y2);
            break;
          case 'qrcode':
            lowest = Math.max(lowest, primitive.y + primitive.size);
            break;
          default:
            lowest = Math.max(lowest, primitive.y + primitive.h);
            break;
        }
      }
    }
    // A little tail so a cut line is not flush with the paper edge.
    return Math.max(20, lowest + 5);
  }

  // ─── Async asset preparation ───────────────────────────────────────────

  private async prepareAssets(
    page: LayoutPage,
    options: RenderOptions,
  ): Promise<Map<number, Buffer>> {
    const assets = new Map<number, Buffer>();
    const resolveImage =
      options.resolveImage ?? ((source: string) => this.images.resolveImage(source));

    await Promise.all(
      page.primitives.map(async (primitive, index) => {
        switch (primitive.k) {
          case 'image': {
            const bytes = await resolveImage(primitive.src);
            if (bytes) {
              assets.set(index, bytes);
            }
            break;
          }
          case 'barcode': {
            const generated = await this.barcodes.barcode(
              primitive.symbology,
              primitive.value,
              primitive.w,
              primitive.h,
              primitive.showText,
            );
            if (generated) {
              assets.set(index, generated.png);
            }
            break;
          }
          case 'qrcode': {
            const generated = await this.barcodes.qrcode(
              primitive.value,
              primitive.size,
              primitive.errorCorrection,
            );
            if (generated) {
              assets.set(index, generated.png);
            }
            break;
          }
          default:
            break;
        }
      }),
    );

    return assets;
  }

  // ─── Drawing ───────────────────────────────────────────────────────────

  private drawPage(
    document: PDFKit.PDFDocument,
    page: LayoutPage,
    assets: Map<number, Buffer>,
    pageWidthMm: number,
    pageHeightMm: number,
    warnings: string[],
  ): void {
    page.primitives.forEach((primitive, index) => {
      this.reportOverflow(primitive, page.index, pageWidthMm, pageHeightMm, warnings);

      switch (primitive.k) {
        case 'rect':
          this.drawRect(document, primitive);
          break;
        case 'line':
          this.drawLine(document, primitive);
          break;
        case 'path':
          this.drawPath(document, primitive);
          break;
        case 'text':
          this.drawText(document, primitive);
          break;
        case 'image':
          this.drawImage(document, primitive, assets.get(index));
          break;
        case 'barcode':
          this.drawBarcode(document, primitive, assets.get(index));
          break;
        case 'qrcode':
          this.drawQrCode(document, primitive, assets.get(index));
          break;
        default:
          break;
      }
    });
  }

  private drawRect(document: PDFKit.PDFDocument, primitive: RectPrimitive): void {
    const x = mmToPoints(primitive.x);
    const y = mmToPoints(primitive.y);
    const width = mmToPoints(primitive.w);
    const height = mmToPoints(primitive.h);

    if (width <= 0 || height <= 0) {
      return;
    }

    const outline = (inset: number) => {
      const radius = Math.max(0, mmToPoints(primitive.radiusMm) - inset);
      if (radius > 0) {
        document.roundedRect(x + inset, y + inset, width - inset * 2, height - inset * 2, radius);
      } else {
        document.rect(x + inset, y + inset, width - inset * 2, height - inset * 2);
      }
    };

    if (primitive.dash === 'DOUBLE' && primitive.stroke) {
      // Fill once, then two outlines: the outer on the box, the inner inset.
      if (primitive.fill) {
        outline(0);
        document.fillColor(primitive.fill).fill();
      }
      const gap = doubleGapPt(primitive.strokeWidthPt);
      outline(0);
      document.strokeColor(primitive.stroke).lineWidth(primitive.strokeWidthPt).stroke();
      if (width > gap * 2 && height > gap * 2) {
        outline(gap);
        document.stroke();
      }
      return;
    }

    outline(0);

    if (primitive.fill && primitive.stroke) {
      this.withDash(document, primitive.dash, primitive.strokeWidthPt, () =>
        document
          .fillColor(primitive.fill as string)
          .strokeColor(primitive.stroke as string)
          .lineWidth(primitive.strokeWidthPt)
          .fillAndStroke(),
      );
    } else if (primitive.fill) {
      document.fillColor(primitive.fill).fill();
    } else if (primitive.stroke) {
      this.withDash(document, primitive.dash, primitive.strokeWidthPt, () =>
        document
          .strokeColor(primitive.stroke as string)
          .lineWidth(primitive.strokeWidthPt)
          .stroke(),
      );
    } else {
      // A rect with neither fill nor stroke would leave the path open and the
      // next drawing operation would inherit it.
      document.strokeColor('#000000').lineWidth(0.5).stroke();
    }
  }

  /** Run a stroke with a dash pattern set, and clear it after. */
  private withDash(
    document: PDFKit.PDFDocument,
    style: LineStyle | undefined,
    widthPt: number,
    draw: () => void,
  ): void {
    const pattern = style && style !== 'SOLID' && style !== 'DOUBLE' ? DASH_PATTERNS[style] : null;
    if (!pattern) {
      draw();
      return;
    }
    const unit = Math.max(widthPt, 1);
    (document.dash as unknown as (length: number[]) => PDFKit.PDFDocument)(
      pattern.map((step) => step * unit),
    );
    draw();
    document.undash();
  }

  /**
   * A `path` primitive: an ellipse, triangle, rhombus, arrowhead, pie slice or
   * chart line. The path is in millimetres with absolute M/L/C/Z only, so
   * converting it is scaling every number.
   */
  private drawPath(document: PDFKit.PDFDocument, primitive: PathPrimitive): void {
    if (!primitive.fill && !primitive.stroke) {
      return;
    }
    const d = primitive.d.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi, (value) =>
      String(mmToPoints(Number(value))),
    );
    document.path(d);
    if (primitive.fill && primitive.stroke) {
      this.withDash(document, primitive.dash, primitive.strokeWidthPt, () =>
        document
          .fillColor(primitive.fill as string)
          .strokeColor(primitive.stroke as string)
          .lineWidth(primitive.strokeWidthPt)
          .fillAndStroke(),
      );
    } else if (primitive.fill) {
      document.fillColor(primitive.fill).fill();
    } else {
      this.withDash(document, primitive.dash, primitive.strokeWidthPt, () =>
        document
          .strokeColor(primitive.stroke as string)
          .lineWidth(primitive.strokeWidthPt)
          .stroke(),
      );
    }
  }

  private drawLine(document: PDFKit.PDFDocument, primitive: LinePrimitive): void {
    const x1 = mmToPoints(primitive.x1);
    const y1 = mmToPoints(primitive.y1);
    const x2 = mmToPoints(primitive.x2);
    const y2 = mmToPoints(primitive.y2);

    if (primitive.dash === 'DOUBLE') {
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length === 0) {
        return;
      }
      // Two strokes, offset either side of the line's own centre.
      const offset = doubleGapPt(primitive.widthPt) / 2;
      const nx = (-(y2 - y1) / length) * offset;
      const ny = ((x2 - x1) / length) * offset;
      document.strokeColor(primitive.color).lineWidth(primitive.widthPt);
      document
        .moveTo(x1 + nx, y1 + ny)
        .lineTo(x2 + nx, y2 + ny)
        .stroke();
      document
        .moveTo(x1 - nx, y1 - ny)
        .lineTo(x2 - nx, y2 - ny)
        .stroke();
      return;
    }

    this.withDash(document, primitive.dash, primitive.widthPt, () =>
      document
        .moveTo(x1, y1)
        .lineTo(x2, y2)
        .strokeColor(primitive.color)
        .lineWidth(primitive.widthPt)
        .stroke(),
    );
  }

  /**
   * Draw a text primitive, one script run at a time.
   *
   * This is the Phase 0.2 finding in code. Each line is split into runs, each
   * run measured with the face that will draw it, the line's total width used
   * for alignment, and then each run drawn at its own x. Handing the whole
   * string to PDFKit with one font is what produces .notdef boxes on a
   * bilingual item name.
   */
  private drawText(document: PDFKit.PDFDocument, primitive: TextPrimitive): void {
    const rotation = primitive.rotation ?? 0;
    const opacity = primitive.opacity;
    if (!rotation && opacity === undefined) {
      this.drawTextBody(document, primitive);
      return;
    }

    document.save();
    if (opacity !== undefined) {
      document.opacity(opacity);
    }
    let box = primitive;
    if (rotation) {
      const centreX = primitive.x + primitive.w / 2;
      const centreY = primitive.y + primitive.h / 2;
      document.rotate(rotation, { origin: [mmToPoints(centreX), mmToPoints(centreY)] });
      // Quarter turns lay the text along the box's other side: draw it in a
      // box with the sides swapped, centred on the same point.
      if (Math.abs(rotation % 180) === 90) {
        box = {
          ...primitive,
          x: centreX - primitive.h / 2,
          y: centreY - primitive.w / 2,
          w: primitive.h,
          h: primitive.w,
        };
      }
    }
    this.drawTextBody(document, box);
    document.restore();
  }

  private drawTextBody(document: PDFKit.PDFDocument, primitive: TextPrimitive): void {
    const lines = primitive.lines.length > 0 ? primitive.lines : [primitive.text];
    const lineHeightPt = mmToPoints(primitive.lineHeightMm);
    const boxWidthPt = mmToPoints(primitive.w);
    const boxHeightPt = mmToPoints(primitive.h);
    const totalTextHeightPt = lines.length * lineHeightPt;

    // Vertical alignment inside the element box.
    let cursorYPt = mmToPoints(primitive.y);
    if (primitive.vAlign === 'middle') {
      cursorYPt += Math.max(0, (boxHeightPt - totalTextHeightPt) / 2);
    } else if (primitive.vAlign === 'bottom') {
      cursorYPt += Math.max(0, boxHeightPt - totalTextHeightPt);
    }

    lines.forEach((line, index) => {
      const rich = primitive.rich?.[index];
      const pieces = rich ? this.richPieces(rich) : line ? this.plainPieces(line, primitive) : [];
      if (pieces.length > 0) {
        this.drawPieces(
          document,
          pieces,
          primitive,
          cursorYPt,
          boxWidthPt,
          lineHeightPt,
          primitive.align === 'justify' && primitive.justify?.[index] === true,
        );
      }
      cursorYPt += lineHeightPt;
    });
  }

  /** One plain line, split into script runs in the primitive's own style. */
  private plainPieces(line: string, primitive: TextPrimitive): TextPiece[] {
    const ascentPt = this.ascentPt(primitive.font, primitive.font.sizePt);
    return splitScriptRuns(line).map((run) => {
      const face = this.fonts.resolveForScript(
        {
          family: primitive.font.family,
          bold: primitive.font.bold,
          italic: primitive.font.italic,
        },
        run.script,
      );
      return {
        text: run.text,
        face,
        sizePt: primitive.font.sizePt,
        color: primitive.color,
        widthPt: this.runWidthPt(run.text, face, primitive.font.sizePt),
        underline: primitive.font.underline,
        strikeout: primitive.font.strikeout === true,
        ascentPt,
      };
    });
  }

  /** One markup line: each styled run, split again by script. */
  private richPieces(runs: readonly RichRun[]): TextPiece[] {
    const pieces: TextPiece[] = [];
    for (const run of runs) {
      const ascentPt = this.ascentPt(run.font, run.font.sizePt);
      for (const scriptRun of splitScriptRuns(run.text)) {
        const face = this.fonts.resolveForScript(
          { family: run.font.family, bold: run.font.bold, italic: run.font.italic },
          scriptRun.script,
        );
        pieces.push({
          text: scriptRun.text,
          face,
          sizePt: run.font.sizePt,
          color: run.color,
          widthPt: this.runWidthPt(scriptRun.text, face, run.font.sizePt),
          underline: run.font.underline,
          strikeout: run.font.strikeout === true,
          ...(run.shift ? { shift: run.shift } : {}),
          ascentPt,
        });
      }
    }
    return pieces;
  }

  /** Ascent of a style's PRIMARY face -- the same for every script run of it. */
  private ascentPt(
    font: { family: string; bold: boolean; italic: boolean },
    sizePt: number,
  ): number {
    const face = this.fonts.resolve({ family: font.family, bold: font.bold, italic: font.italic });
    return (face.ascent / face.unitsPerEm) * sizePt;
  }

  /**
   * Draw one line of pieces, aligned in the box.
   *
   * Every piece sits on one shared baseline -- the tallest run's -- so a 14pt
   * word in a 9pt line, or a bold run beside a regular one, lines up the way
   * it would in a word processor. A plain line has one style, so its baseline
   * offset is zero and it prints exactly as it always has.
   *
   * Justified lines are drawn word by word with the spare width shared out
   * between the spaces, rather than through PDFKit's wordSpacing: that trims
   * the spaces at the edges of each script run and would drift every word
   * after a Latin/Tamil boundary.
   */
  private drawPieces(
    document: PDFKit.PDFDocument,
    pieces: readonly TextPiece[],
    primitive: TextPrimitive,
    yPt: number,
    boxWidthPt: number,
    lineHeightPt: number,
    justify: boolean,
  ): void {
    const totalWidthPt = pieces.reduce((total, piece) => total + piece.widthPt, 0);
    const lineAscentPt = Math.max(
      ...pieces.filter((piece) => !piece.shift).map((piece) => piece.ascentPt),
      pieces[0].ascentPt,
    );
    const baselinePt = yPt + lineAscentPt;

    let extraPerSpacePt = 0;
    if (justify) {
      const spaces = pieces.reduce(
        (count, piece) => count + (piece.text.match(/ /g)?.length ?? 0),
        0,
      );
      if (spaces > 0 && boxWidthPt > totalWidthPt) {
        extraPerSpacePt = (boxWidthPt - totalWidthPt) / spaces;
      }
    }

    let xPt = mmToPoints(primitive.x);
    if (!justify) {
      if (primitive.align === 'right') {
        xPt += boxWidthPt - totalWidthPt;
      } else if (primitive.align === 'center') {
        xPt += (boxWidthPt - totalWidthPt) / 2;
      }
    }

    for (const piece of pieces) {
      const baseSizePt = piece.shift ? piece.sizePt / 0.7 : piece.sizePt;
      const shiftPt =
        piece.shift === 'sup' ? -baseSizePt * 0.35 : piece.shift === 'sub' ? baseSizePt * 0.15 : 0;
      const topPt = baselinePt - piece.ascentPt + shiftPt;
      const startXPt = xPt;

      document.font(piece.face.id).fontSize(piece.sizePt).fillColor(piece.color);
      if (extraPerSpacePt > 0 && piece.text.includes(' ')) {
        for (const token of piece.text.split(/( +)/)) {
          if (!token) {
            continue;
          }
          const tokenWidthPt = this.runWidthPt(token, piece.face, piece.sizePt);
          if (token.startsWith(' ')) {
            xPt += tokenWidthPt + extraPerSpacePt * token.length;
          } else {
            // lineBreak: false is essential -- PDFKit would otherwise re-wrap
            // text the layout engine already wrapped, at a different width.
            document.text(token, xPt, topPt, { lineBreak: false, width: undefined });
            xPt += tokenWidthPt;
          }
        }
      } else {
        document.text(piece.text, xPt, topPt, { lineBreak: false, width: undefined });
        xPt += piece.widthPt;
      }

      if ((piece.underline || piece.strikeout) && xPt > startXPt) {
        const ruleWidthPt = Math.max(0.3, piece.sizePt / 18);
        document.strokeColor(piece.color).lineWidth(ruleWidthPt);
        if (piece.underline) {
          // Just below the baseline: where a plain line has always put it,
          // 85% down its line box.
          const underlineYPt = yPt + lineHeightPt * 0.85 + shiftPt;
          document.moveTo(startXPt, underlineYPt).lineTo(xPt, underlineYPt).stroke();
        }
        if (piece.strikeout) {
          // Through the middle of the lowercase letters.
          const strikeYPt = baselinePt + shiftPt - piece.sizePt * 0.28;
          document.moveTo(startXPt, strikeYPt).lineTo(xPt, strikeYPt).stroke();
        }
      }
    }
  }

  /**
   * Advance width of one run, via fontkit's shaping layout.
   *
   * The same call TextMeasurer uses. They must agree exactly, or a right-aligned
   * amount column drifts: the layout engine would reserve one width and the
   * renderer would draw at another.
   */
  private runWidthPt(text: string, face: LoadedFont, sizePt: number): number {
    try {
      return (face.font.layout(text).advanceWidth / face.unitsPerEm) * sizePt;
    } catch {
      return [...text].length * sizePt * 0.5;
    }
  }

  private drawImage(
    document: PDFKit.PDFDocument,
    primitive: ImagePrimitive,
    bytes: Buffer | undefined,
  ): void {
    if (!bytes) {
      return;
    }

    const x = mmToPoints(primitive.x);
    const y = mmToPoints(primitive.y);
    const width = mmToPoints(primitive.w);
    const height = mmToPoints(primitive.h);

    const faded = primitive.opacity !== undefined;
    if (faded) {
      document.save();
      document.opacity(primitive.opacity as number);
    }

    try {
      switch (primitive.fit) {
        case 'STRETCH':
          document.image(bytes, x, y, { width, height });
          break;
        case 'COVER':
          document.image(bytes, x, y, {
            cover: [width, height],
            align: 'center',
            valign: 'center',
          });
          break;
        case 'CONTAIN':
        default:
          document.image(bytes, x, y, { fit: [width, height], align: 'center', valign: 'center' });
          break;
      }
    } catch (error) {
      // An unsupported format (SVG, WebP, a truncated upload) must not take the
      // invoice with it.
      this.logger.warn(
        `Image could not be embedded: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (faded) {
        document.restore();
      }
    }
  }

  private drawBarcode(
    document: PDFKit.PDFDocument,
    primitive: BarcodePrimitive,
    bytes: Buffer | undefined,
  ): void {
    if (!bytes) {
      return;
    }
    try {
      document.image(bytes, mmToPoints(primitive.x), mmToPoints(primitive.y), {
        // fit rather than width/height: stretching a barcode to an arbitrary box
        // distorts the module widths and a scanner refuses it.
        // 'fit' scales to the box preserving aspect; left/top is PDFKit's
        // default anchor, and 'left'/'top' are not accepted values.
        fit: [mmToPoints(primitive.w), mmToPoints(primitive.h)],
      });
    } catch (error) {
      this.logger.warn(
        `Barcode could not be embedded: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private drawQrCode(
    document: PDFKit.PDFDocument,
    primitive: QrCodePrimitive,
    bytes: Buffer | undefined,
  ): void {
    if (!bytes) {
      return;
    }
    const size = mmToPoints(primitive.size);
    try {
      document.image(bytes, mmToPoints(primitive.x), mmToPoints(primitive.y), {
        width: size,
        height: size,
      });
    } catch (error) {
      this.logger.warn(
        `QR code could not be embedded: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Report a primitive that falls off the page.
   *
   * The save-time bounds check in the zod schema catches static overflow. This
   * catches the dynamic kind: a customer name long enough to push a
   * right-aligned block past the edge, which only appears with real data.
   */
  private reportOverflow(
    primitive: LayoutPage['primitives'][number],
    pageIndex: number,
    pageWidthMm: number,
    pageHeightMm: number,
    warnings: string[],
  ): void {
    const right =
      primitive.k === 'line'
        ? Math.max(primitive.x1, primitive.x2)
        : primitive.k === 'qrcode'
          ? primitive.x + primitive.size
          : primitive.x + primitive.w;

    const bottom =
      primitive.k === 'line'
        ? Math.max(primitive.y1, primitive.y2)
        : primitive.k === 'qrcode'
          ? primitive.y + primitive.size
          : primitive.y + primitive.h;

    if (
      right > pageWidthMm + OVERFLOW_TOLERANCE_MM ||
      bottom > pageHeightMm + OVERFLOW_TOLERANCE_MM
    ) {
      const message =
        `A ${primitive.k} primitive on page ${pageIndex + 1} extends to ` +
        `${right.toFixed(1)}x${bottom.toFixed(1)}mm, past the ${pageWidthMm}x${pageHeightMm.toFixed(0)}mm page`;
      if (!warnings.includes(message)) {
        warnings.push(message);
      }
    }
  }
}
