import { Injectable } from '@nestjs/common';
import { OutputMode } from '../../../definition/template-definition.schema';
import { LayoutTree, Primitive } from '../../layout/layout-tree.types';
import { IRenderer, PrinterCommandProfile, RenderOptions, RenderResult } from '../renderer.types';
import { Codepage } from './codepage';
import { StyledRun } from './grid-canvas';
import { GridRendererBase } from './grid-renderer.base';

/**
 * Phase 5b -- the thermal receipt renderer. ESC/POS.
 *
 * ── The command set ─────────────────────────────────────────────────────────
 *   ESC @      initialise
 *   ESC a n    align         0 left, 1 centre, 2 right
 *   GS  ! n    character size multiplier (low nibble height, high nibble width)
 *   ESC E n    emphasis (bold)
 *   ESC - n    underline
 *   ESC t n    select code page
 *   ESC d n    feed n lines
 *   GS  V m    cut
 *
 * ── Why alignment is per line, not per run ──────────────────────────────────
 * ESC/POS has no absolute horizontal positioning worth relying on: HT depends
 * on tab stops the printer may not have set, and ESC $ is a graphics-mode
 * command many receipt printers ignore. So a line is assembled as a padded
 * string of exactly `columns` characters and sent left-aligned. The GridCanvas
 * has already placed every field in its column, which is what makes that work:
 * the padding IS the layout.
 *
 * That is also why the column budget must match the hardware. 32 characters at
 * font A on a 58mm roll, 48 on an 80mm one. Sending 48 columns to a 58mm
 * printer wraps every line in half.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Epson TM-series defaults. A profile's `commands` are merged over these. */
const DEFAULT_COMMANDS: Record<string, Buffer> = {
  init: Buffer.from([ESC, 0x40]), // ESC @
  alignLeft: Buffer.from([ESC, 0x61, 0x00]), // ESC a 0
  alignCenter: Buffer.from([ESC, 0x61, 0x01]), // ESC a 1
  alignRight: Buffer.from([ESC, 0x61, 0x02]), // ESC a 2
  boldOn: Buffer.from([ESC, 0x45, 0x01]), // ESC E 1
  boldOff: Buffer.from([ESC, 0x45, 0x00]), // ESC E 0
  underlineOn: Buffer.from([ESC, 0x2d, 0x01]), // ESC - 1
  underlineOff: Buffer.from([ESC, 0x2d, 0x00]), // ESC - 0
  sizeNormal: Buffer.from([GS, 0x21, 0x00]), // GS ! 0
  sizeDoubleWidth: Buffer.from([GS, 0x21, 0x10]), // GS ! 0x10
  sizeDoubleHeight: Buffer.from([GS, 0x21, 0x01]), // GS ! 0x01
  sizeDouble: Buffer.from([GS, 0x21, 0x11]), // GS ! 0x11
  lineFeed: Buffer.from([LF]),
  // Feed three lines before cutting: the cutter sits ~15mm past the print head,
  // so without the feed the cut lands in the middle of the last lines.
  feedBeforeCut: Buffer.from([ESC, 0x64, 0x03]),
  cut: Buffer.from([GS, 0x56, 0x42, 0x00]), // GS V 66 0 -- feed and partial cut
  codepageCp437: Buffer.from([ESC, 0x74, 0x00]), // ESC t 0
  codepageCp850: Buffer.from([ESC, 0x74, 0x02]), // ESC t 2
  codepageCp1252: Buffer.from([ESC, 0x74, 0x10]), // ESC t 16
};

/** 48 characters at font A on an 80mm roll. */
const DEFAULT_COLUMNS = 48;

/** Raster bit-image chunking limit; a single GS v 0 block is capped by width. */
const MAX_RASTER_WIDTH_DOTS = 576;

@Injectable()
export class EscPosRenderer extends GridRendererBase implements IRenderer {
  readonly outputMode: OutputMode = 'ESCPOS';

  async render(tree: LayoutTree, options: RenderOptions = {}): Promise<RenderResult> {
    const startedAt = Date.now();
    // async by the IRenderer contract, which the genuinely-async PDF renderer
    // shares; the raw renderers are CPU-only, so this yields once to keep the
    // signature honest and the event loop from starving on a large batch.
    await Promise.resolve();
    const profile = options.printerProfile ?? null;
    const columns = this.resolveColumns(tree, profile);
    const codepage = this.resolveCodepage(profile);
    const commands = mergeCommands(profile);

    const warnings = new Set<string>(
      tree.warnings.map(
        (warning) =>
          `${warning.kind}: ${warning.message}${warning.detail ? ` (${warning.detail})` : ''}`,
      ),
    );

    const chunks: Buffer[] = [];

    chunks.push(commands.init);
    chunks.push(this.codepageCommand(commands, codepage.name));
    chunks.push(commands.alignLeft);

    tree.pages.forEach((page, pageIndex) => {
      const { canvas, warnings: pageWarnings } = this.toCanvas(page, columns, codepage);
      for (const warning of pageWarnings) {
        warnings.add(warning);
      }

      for (const runs of canvas.allRuns()) {
        chunks.push(this.encodeLine(runs, columns, commands, codepage, profile));
        chunks.push(commands.lineFeed);
      }

      // A receipt is one document per cut. A multi-page thermal render is
      // several receipts, so each gets its own cut rather than one at the end.
      if (profile?.supportsCut ?? true) {
        chunks.push(commands.feedBeforeCut);
        chunks.push(commands.cut);
      } else if (pageIndex < tree.pages.length - 1) {
        // No cutter: feed enough to clear the tear bar instead.
        chunks.push(Buffer.from([ESC, 0x64, 0x05]));
      }
    });

    // Leave the printer in a clean state for whatever prints next.
    chunks.push(commands.init);

    const bytes = Buffer.concat(chunks);
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `ESC/POS rendered: ${tree.pageCount} receipt(s), ${columns} columns, ${bytes.length} bytes, ${durationMs}ms`,
    );

    return {
      bytes,
      contentType: 'application/octet-stream',
      extension: 'bin',
      pageCount: tree.pageCount,
      durationMs,
      warnings: [...warnings],
    };
  }

  protected defaultColumns(): number {
    return DEFAULT_COLUMNS;
  }

  /**
   * Thermal printers CAN raster a logo (GS v 0), and a receipt with the shop's
   * logo is a normal expectation — a thermal head is fast enough that a small
   * bitmap costs a fraction of a second, unlike a dot matrix.
   *
   * Rasterising a PNG needs a decoder, though, and pulling one in for this is
   * not warranted while the print clients can send the logo themselves. So the
   * element is skipped with a warning that says what the path is, rather than
   * pretending the format cannot do it.
   */
  protected onGraphicPrimitive(primitive: Primitive, warnings: Set<string>): void {
    if (primitive.k === 'image') {
      warnings.add(
        'A logo was skipped: thermal raster output (GS v 0) is not implemented yet. ' +
          `The printer supports it — a bitmap up to ${MAX_RASTER_WIDTH_DOTS} dots wide — ` +
          'so this is a gap to fill, not a hardware limit.',
      );
      return;
    }

    warnings.add(
      `A ${primitive.k} element was skipped: thermal output currently prints text only. ` +
        'Print the value as text, or use the PDF path.',
    );
  }

  /** ESC t n, selecting the code page the encoded bytes are meant for. */
  private codepageCommand(commands: Record<string, Buffer>, codepageName: string): Buffer {
    switch (codepageName) {
      case 'CP850':
        return commands.codepageCp850;
      case 'CP1252':
        return commands.codepageCp1252;
      case 'CP437':
      case 'ASCII':
      default:
        return commands.codepageCp437;
    }
  }

  /**
   * Assemble one line.
   *
   * The GridCanvas has already placed every field at its column, so the line is
   * built by padding between runs and sent left-aligned. Style brackets go
   * around each run; alignment and size are line-level, because ESC/POS applies
   * `ESC a` and `GS !` to whole lines in practice.
   */
  private encodeLine(
    runs: readonly StyledRun[],
    columns: number,
    commands: Record<string, Buffer>,
    codepage: Codepage,
    profile: PrinterCommandProfile | null,
  ): Buffer {
    if (runs.length === 0) {
      return Buffer.alloc(0);
    }

    // A double-width line holds half as many characters, so it cannot be
    // assembled on the same grid as the rest. Such a line is sent on its own,
    // centred, which is how a receipt's total and shop name are printed anyway.
    const enlarged = runs.find((run) => run.style.doubleWidth || run.style.doubleHeight);
    if (enlarged) {
      return this.encodeEnlargedLine(runs, columns, commands, codepage);
    }

    const parts: Buffer[] = [];
    let cursorColumn = 0;
    let boldOn = false;
    let underlineOn = false;

    for (const run of runs) {
      if (run.col > cursorColumn) {
        parts.push(Buffer.alloc(run.col - cursorColumn, 0x20));
        cursorColumn = run.col;
      }

      const wantBold = run.style.bold && (profile?.supportsBold ?? true);
      const wantUnderline = run.style.underline && (profile?.supportsUnderline ?? true);

      if (wantBold !== boldOn) {
        parts.push(wantBold ? commands.boldOn : commands.boldOff);
        boldOn = wantBold;
      }
      if (wantUnderline !== underlineOn) {
        parts.push(wantUnderline ? commands.underlineOn : commands.underlineOff);
        underlineOn = wantUnderline;
      }

      const characters = [...run.text];
      // Clip rather than let the line wrap: a wrapped receipt line pushes every
      // following line's alignment out by the overflow.
      const room = Math.max(0, columns - cursorColumn);
      const clipped = characters.slice(0, room).join('');
      parts.push(codepage.encode(clipped).bytes);
      cursorColumn += [...clipped].length;
    }

    if (boldOn) {
      parts.push(commands.boldOff);
    }
    if (underlineOn) {
      parts.push(commands.underlineOff);
    }

    return Buffer.concat(parts);
  }

  private encodeEnlargedLine(
    runs: readonly StyledRun[],
    columns: number,
    commands: Record<string, Buffer>,
    codepage: Codepage,
  ): Buffer {
    const text = runs
      .map((run) => run.text)
      .join(' ')
      .trim();
    const style = runs[0].style;

    const sizeCommand =
      style.doubleWidth && style.doubleHeight
        ? commands.sizeDouble
        : style.doubleWidth
          ? commands.sizeDoubleWidth
          : commands.sizeDoubleHeight;

    // At double width the usable budget halves.
    const budget = style.doubleWidth ? Math.floor(columns / 2) : columns;
    const clipped = [...text].slice(0, budget).join('');

    return Buffer.concat([
      style.centered ? commands.alignCenter : commands.alignLeft,
      sizeCommand,
      style.bold ? commands.boldOn : Buffer.alloc(0),
      codepage.encode(clipped).bytes,
      style.bold ? commands.boldOff : Buffer.alloc(0),
      commands.sizeNormal,
      commands.alignLeft,
    ]);
  }
}

const mergeCommands = (profile: PrinterCommandProfile | null): Record<string, Buffer> => {
  if (!profile?.commands) {
    return DEFAULT_COMMANDS;
  }
  return { ...DEFAULT_COMMANDS, ...profile.commands };
};
