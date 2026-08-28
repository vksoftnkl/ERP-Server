import { Injectable, Logger } from '@nestjs/common';
// `import = require()` rather than a namespace or default import: pdfkit is
// CommonJS (`module.exports = PDFDocument`, typed `export =`) and this tsconfig
// sets allowSyntheticDefaultImports WITHOUT esModuleInterop. A namespace import
// typechecks and then yields a non-callable module object under tsx/ESM interop,
// and a default import yields undefined.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PdfDocument = require('pdfkit');
import { OutputMode } from '../../definition/template-definition.schema';
import { FontRegistry, LoadedFont } from '../fonts/font.registry';
import { splitScriptRuns } from '../fonts/script-runs';
import {
  BarcodePrimitive,
  ImagePrimitive,
  LayoutPage,
  LayoutTree,
  LinePrimitive,
  QrCodePrimitive,
  RectPrimitive,
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

    if (primitive.radiusMm > 0) {
      document.roundedRect(x, y, width, height, mmToPoints(primitive.radiusMm));
    } else {
      document.rect(x, y, width, height);
    }

    if (primitive.fill && primitive.stroke) {
      document
        .fillColor(primitive.fill)
        .strokeColor(primitive.stroke)
        .lineWidth(primitive.strokeWidthPt)
        .fillAndStroke();
    } else if (primitive.fill) {
      document.fillColor(primitive.fill).fill();
    } else if (primitive.stroke) {
      document.strokeColor(primitive.stroke).lineWidth(primitive.strokeWidthPt).stroke();
    } else {
      // A rect with neither fill nor stroke would leave the path open and the
      // next drawing operation would inherit it.
      document.strokeColor('#000000').lineWidth(0.5).stroke();
    }
  }

  private drawLine(document: PDFKit.PDFDocument, primitive: LinePrimitive): void {
    document
      .moveTo(mmToPoints(primitive.x1), mmToPoints(primitive.y1))
      .lineTo(mmToPoints(primitive.x2), mmToPoints(primitive.y2))
      .strokeColor(primitive.color)
      .lineWidth(primitive.widthPt)
      .stroke();
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

    document.fillColor(primitive.color);

    for (const line of lines) {
      if (line !== '') {
        this.drawTextLine(document, line, primitive, cursorYPt, boxWidthPt, lineHeightPt);
      }
      cursorYPt += lineHeightPt;
    }
  }

  private drawTextLine(
    document: PDFKit.PDFDocument,
    line: string,
    primitive: TextPrimitive,
    yPt: number,
    boxWidthPt: number,
    lineHeightPt: number,
  ): void {
    const runs = splitScriptRuns(line).map((run) => {
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
        widthPt: this.runWidthPt(run.text, face, primitive.font.sizePt),
      };
    });

    const totalWidthPt = runs.reduce((total, run) => total + run.widthPt, 0);

    let xPt = mmToPoints(primitive.x);
    if (primitive.align === 'right') {
      xPt += boxWidthPt - totalWidthPt;
    } else if (primitive.align === 'center') {
      xPt += (boxWidthPt - totalWidthPt) / 2;
    }

    for (const run of runs) {
      document.font(run.face.id).fontSize(primitive.font.sizePt);
      // lineBreak: false is essential -- PDFKit would otherwise re-wrap text
      // the layout engine already wrapped, at a different width, and the two
      // wraps would disagree.
      document.text(run.text, xPt, yPt, { lineBreak: false, width: undefined });
      xPt += run.widthPt;
    }

    if (primitive.font.underline && totalWidthPt > 0) {
      const startXPt = xPt - totalWidthPt;
      // Just below the baseline, which sits at the line's ascent.
      const underlineYPt = yPt + lineHeightPt * 0.85;
      document
        .moveTo(startXPt, underlineYPt)
        .lineTo(startXPt + totalWidthPt, underlineYPt)
        .strokeColor(primitive.color)
        .lineWidth(Math.max(0.3, primitive.font.sizePt / 18))
        .stroke();
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
