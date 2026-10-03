import { Readable } from 'node:stream';
import { OutputMode } from '../../definition/template-definition.schema';
import { LayoutTree } from '../layout/layout-tree.types';

/**
 * The renderer contract.
 *
 * A renderer consumes a LayoutTree -- absolutely positioned primitives with
 * every expression already evaluated -- and produces bytes. It does no layout,
 * no pagination, no expression evaluation and no data access. That is what
 * makes adding an output format a few hundred lines instead of a rewrite, and
 * what makes the layout fixtures in layout.engine.spec.ts meaningful: if they
 * pass, no renderer can introduce a pagination bug.
 *
 * Renderers return a Buffer rather than piping directly to the response. A
 * 4 GB VPS with a BullMQ worker needs to know how big a render got before it
 * commits to holding it, and a bulk job has to write the result to a file
 * regardless. `stream()` is the convenience wrapper for the single-document
 * HTTP path.
 */

export interface RenderOptions {
  /**
   * Printer profile for the raw renderers -- command dialect, codepage and
   * column budget. Ignored by the PDF renderer.
   */
  readonly printerProfile?: PrinterCommandProfile | null;
  /** Resolve an image source to bytes. Absent = images are skipped. */
  readonly resolveImage?: (source: string) => Promise<Buffer | null>;
  /** Hard ceiling in milliseconds. A renderer that exceeds it should abort. */
  readonly timeoutMs?: number;
  /**
   * The document's creation timestamp.
   *
   * Pinning this makes a PDF render BYTE-IDENTICAL for identical input, because
   * PDFKit derives the trailer's /ID from md5(CreationDate + info) -- the only
   * non-deterministic byte in the output. That reproducibility is what lets a
   * reprint be de-duplicated, a render be cached, and a golden-file test mean
   * anything. Production passes the request time so Reader shows the truth;
   * tests pass a fixed date.
   */
  readonly creationDate?: Date;
}

export interface RenderResult {
  readonly bytes: Buffer;
  readonly contentType: string;
  /** Suggested download filename extension, without the dot. */
  readonly extension: string;
  readonly pageCount: number;
  readonly durationMs: number;
  /** Problems that did not stop the render. */
  readonly warnings: readonly string[];
}

export interface IRenderer {
  readonly outputMode: OutputMode;
  render(tree: LayoutTree, options?: RenderOptions): Promise<RenderResult>;
}

/**
 * A printer's escape-command dialect, loaded from reports.printer_profile.
 *
 * Risk R6: ESC/P and ESC/POS differ by model family in ways no datasheet
 * settles. Rather than compile a customer's printer quirks into the renderer,
 * the bytes come from here, and onboarding a new model is a seed row.
 */
export interface PrinterCommandProfile {
  readonly code: string;
  readonly name: string;
  readonly family: string;
  readonly columns: number;
  readonly cpi: number | null;
  readonly paperWidthMm: number | null;
  readonly codepage: string;
  readonly supportsBold: boolean;
  readonly supportsUnderline: boolean;
  readonly supportsCut: boolean;
  readonly supportsGraphics: boolean;
  /** Capability name -> raw bytes. Sparse; merged over built-in defaults. */
  readonly commands: Readonly<Record<string, Buffer>>;
}

/** Wrap a finished render as a stream for the HTTP path. */
export const toStream = (bytes: Buffer): Readable => Readable.from([bytes]);
