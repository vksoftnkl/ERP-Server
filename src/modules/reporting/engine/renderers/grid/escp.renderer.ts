import { Injectable } from '@nestjs/common';
import { OutputMode } from '../../../templates/dto/template-definition.schema';
import { LayoutTree, Primitive } from '../../layout/layout-tree.types';
import { IRenderer, PrinterCommandProfile, RenderOptions, RenderResult } from '../renderer.types';
import { Codepage } from './codepage';
import { StyledRun } from './grid-canvas';
import { GridRendererBase } from './grid-renderer.base';

/**
 * Phase 5a -- the dot-matrix renderer. Epson ESC/P.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * This is the market differentiator. A kirana wholesale distributor prints a
 * hundred invoices a day on a TVS MSP or an Epson LX, and the reason Tally and
 * Marg feel fast on that hardware is that they send raw draft-mode text: the
 * printer's own ROM renders the glyphs and the head makes a single pass per
 * line. A PDF sent to the same printer is rasterised into bitmap columns and
 * takes 30-60 seconds a page. Being fast here is not a nicety.
 *
 * ── The command set ─────────────────────────────────────────────────────────
 *   ESC @      initialise
 *   ESC x 0    draft quality  (the speed setting -- ESC x 1 is LQ and slow)
 *   ESC P      10 CPI       ESC M  12 CPI       ESC g  15 CPI
 *   SI         condensed on   DC2   condensed off
 *   ESC E      bold on        ESC F  bold off
 *   ESC -1     underline on   ESC -0 underline off
 *   ESC C n    form length in lines
 *   ESC $      absolute horizontal position (used instead of space padding)
 *   FF         form feed
 *
 * Every byte comes from the printer PROFILE, defaulting to these. Risk R6 is
 * that model families differ; a customer's TVS quirk should be a seed row in
 * reports.printer_profile, not a code change.
 *
 * ── Tamil ───────────────────────────────────────────────────────────────────
 * Not printable here, at any setting. A character ROM has no Tamil glyphs, and
 * the only alternative is graphics mode, which is the slowness this path
 * exists to avoid. The base class raises that as its own warning so the print
 * API can steer the operator to a PDF template instead.
 */

const ESC = 0x1b;
const FF = 0x0c;
const CR = 0x0d;
const LF = 0x0a;
const SI = 0x0f;
const DC2 = 0x12;

/** Epson ESC/P defaults. A profile's `commands` are merged over these. */
const DEFAULT_COMMANDS: Record<string, Buffer> = {
  init: Buffer.from([ESC, 0x40]), // ESC @
  draft: Buffer.from([ESC, 0x78, 0x00]), // ESC x 0
  letterQuality: Buffer.from([ESC, 0x78, 0x01]), // ESC x 1
  pitch10: Buffer.from([ESC, 0x50]), // ESC P
  pitch12: Buffer.from([ESC, 0x4d]), // ESC M
  pitch15: Buffer.from([ESC, 0x67]), // ESC g
  condensedOn: Buffer.from([SI]),
  condensedOff: Buffer.from([DC2]),
  boldOn: Buffer.from([ESC, 0x45]), // ESC E
  boldOff: Buffer.from([ESC, 0x46]), // ESC F
  underlineOn: Buffer.from([ESC, 0x2d, 0x01]), // ESC - 1
  underlineOff: Buffer.from([ESC, 0x2d, 0x00]), // ESC - 0
  doubleWidthOn: Buffer.from([ESC, 0x57, 0x01]), // ESC W 1
  doubleWidthOff: Buffer.from([ESC, 0x57, 0x00]), // ESC W 0
  lineFeed: Buffer.from([CR, LF]),
  formFeed: Buffer.from([FF]),
  reset: Buffer.from([ESC, 0x40]),
};

/** 80 columns at 10 CPI on 9.5in fanfold -- the commonest Indian setup. */
const DEFAULT_COLUMNS = 80;

/** 66 lines at 6 LPI on an 11in form. */
const DEFAULT_FORM_LINES = 66;

@Injectable()
export class EscPRenderer extends GridRendererBase implements IRenderer {
  readonly outputMode: OutputMode = 'ESCP_DOTMATRIX';

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

    // ── Job preamble ─────────────────────────────────────────────────────
    chunks.push(commands.init);
    // Draft quality is the whole point. A profile can override `draft` with
    // the LQ sequence if a customer wants quality over speed, but the default
    // must be the fast one.
    chunks.push(commands.draft);
    chunks.push(this.pitchCommand(commands, profile, columns, warnings));

    const formLines = tree.paper.rows ?? DEFAULT_FORM_LINES;
    // ESC C n sets the form length so the printer's own form feed lands on the
    // page boundary. Without it a continuous-stationery job drifts by a line
    // per page and after twenty invoices the perforation is mid-total.
    chunks.push(Buffer.from([ESC, 0x43, Math.min(127, Math.max(1, Math.round(formLines)))]));

    // ── Pages ────────────────────────────────────────────────────────────
    tree.pages.forEach((page, pageIndex) => {
      const { canvas, warnings: pageWarnings } = this.toCanvas(page, columns, codepage);
      for (const warning of pageWarnings) {
        warnings.add(warning);
      }

      const rows = canvas.allRuns();
      rows.forEach((runs) => {
        chunks.push(this.encodeRow(runs, commands, codepage, profile));
        chunks.push(commands.lineFeed);
      });

      // Form feed between pages, never after the last one: a trailing feed
      // ejects a blank page, and on fanfold that is a wasted form every job.
      if (pageIndex < tree.pages.length - 1) {
        chunks.push(commands.formFeed);
      }
    });

    // ── Job epilogue ─────────────────────────────────────────────────────
    // Reset so the next job -- possibly from another application -- does not
    // inherit condensed mode or bold.
    chunks.push(commands.reset);

    const bytes = Buffer.concat(chunks);
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `ESC/P rendered: ${tree.pageCount} page(s), ${columns} columns, ${bytes.length} bytes, ${durationMs}ms`,
    );

    return {
      bytes,
      // Deliberately octet-stream: these bytes go to a Windows RAW spool queue
      // or straight down a USB/parallel port, never to a viewer.
      contentType: 'application/octet-stream',
      extension: 'prn',
      pageCount: tree.pageCount,
      durationMs,
      warnings: [...warnings],
    };
  }

  protected defaultColumns(): number {
    return DEFAULT_COLUMNS;
  }

  /**
   * Dot matrix gets NO graphics.
   *
   * A logo or barcode here would mean switching to bitmap mode, which costs
   * tens of seconds per page — the exact thing this renderer exists to avoid.
   * The template should carry the number as text instead, and the warning says
   * so rather than silently dropping the element.
   */
  protected onGraphicPrimitive(primitive: Primitive, warnings: Set<string>): void {
    warnings.add(
      `A ${primitive.k} element was skipped: dot-matrix output is text mode only, and ` +
        'graphics mode would make the print unusably slow. Print the value as text instead.',
    );
  }

  /**
   * Choose the character pitch that fits the column budget.
   *
   * 80 columns at 10 CPI, 96 at 12 CPI, 137 at 15 CPI condensed. Getting this
   * wrong is the classic dot-matrix failure: a 132-column report sent at 10 CPI
   * prints the first 80 columns and wraps the rest onto the next line, turning
   * every invoice line into two.
   */
  private pitchCommand(
    commands: Record<string, Buffer>,
    profile: PrinterCommandProfile | null,
    columns: number,
    warnings: Set<string>,
  ): Buffer {
    const cpi = profile?.cpi ?? inferCpi(columns);

    switch (cpi) {
      case 10:
        if (columns > 80) {
          warnings.add(
            `The profile asks for 10 CPI but the layout is ${columns} columns wide; ` +
              'at 10 CPI only 80 fit on 9.5in stationery and the rest will wrap.',
          );
        }
        return commands.pitch10;
      case 12:
        return commands.pitch12;
      case 15:
        // 15 CPI is reached via condensed mode on most Epson-compatible units,
        // and ESC g alone is not honoured by every family.
        return Buffer.concat([commands.pitch10, commands.condensedOn]);
      default:
        warnings.add(`Unsupported pitch ${cpi} CPI; falling back to 10 CPI.`);
        return commands.pitch10;
    }
  }

  /**
   * Encode one row: position, style brackets, encoded text.
   *
   * ESC $ (absolute horizontal position) is used to skip to a run's column
   * rather than padding with spaces. On a dot matrix a space is real head
   * travel, and a 132-column form with three populated fields per line prints
   * visibly faster when the head jumps.
   */
  private encodeRow(
    runs: readonly StyledRun[],
    commands: Record<string, Buffer>,
    codepage: Codepage,
    profile: PrinterCommandProfile | null,
  ): Buffer {
    if (runs.length === 0) {
      return Buffer.alloc(0);
    }

    const parts: Buffer[] = [];
    let cursorColumn = 0;
    let boldOn = false;
    let underlineOn = false;
    let doubleWidthOn = false;

    const cpi = profile?.cpi ?? 10;
    // ESC $ n1 n2 positions in 1/60in units from the left margin.
    const unitsPerColumn = Math.round(60 / cpi);

    for (const run of runs) {
      if (run.col > cursorColumn) {
        const units = run.col * unitsPerColumn;
        parts.push(Buffer.from([ESC, 0x24, units & 0xff, (units >> 8) & 0xff]));
      }

      const wantBold = run.style.bold && (profile?.supportsBold ?? true);
      const wantUnderline = run.style.underline && (profile?.supportsUnderline ?? true);
      const wantDoubleWidth = run.style.doubleWidth;

      if (wantBold !== boldOn) {
        parts.push(wantBold ? commands.boldOn : commands.boldOff);
        boldOn = wantBold;
      }
      if (wantUnderline !== underlineOn) {
        parts.push(wantUnderline ? commands.underlineOn : commands.underlineOff);
        underlineOn = wantUnderline;
      }
      if (wantDoubleWidth !== doubleWidthOn) {
        parts.push(wantDoubleWidth ? commands.doubleWidthOn : commands.doubleWidthOff);
        doubleWidthOn = wantDoubleWidth;
      }

      parts.push(codepage.encode(run.text).bytes);
      cursorColumn = run.col + [...run.text].length;
    }

    // Close every style at end of line. A bold that leaks past a line break is
    // how a whole invoice ends up emboldened from the total downward.
    if (boldOn) {
      parts.push(commands.boldOff);
    }
    if (underlineOn) {
      parts.push(commands.underlineOff);
    }
    if (doubleWidthOn) {
      parts.push(commands.doubleWidthOff);
    }

    return Buffer.concat(parts);
  }
}

/** Merge a profile's sparse command overrides over the Epson defaults. */
const mergeCommands = (profile: PrinterCommandProfile | null): Record<string, Buffer> => {
  if (!profile?.commands) {
    return DEFAULT_COMMANDS;
  }
  return { ...DEFAULT_COMMANDS, ...profile.commands };
};

/** Narrowest pitch that fits the column budget. */
const inferCpi = (columns: number): number => {
  if (columns <= 80) {
    return 10;
  }
  if (columns <= 96) {
    return 12;
  }
  return 15;
};
