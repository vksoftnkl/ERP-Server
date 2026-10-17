import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fontkit from 'fontkit';
import { ScriptTag } from './script-runs';

/**
 * The report font registry.
 *
 * Faces are loaded once at module init and held for the process lifetime.
 * fontkit parses a 500KB TTF in a few milliseconds, which is nothing once but
 * is 500 wasted milliseconds across a 100-invoice bulk run.
 *
 * Two consumers, one registry:
 *   * the LAYOUT engine, which needs advance widths to wrap and auto-grow
 *   * the PDF renderer, which needs the file path to embed a subset
 *
 * They must agree. A layout that measured with one face and drew with another
 * would wrap in the wrong place — the classic report bug where the last column
 * drifts one character further right on every page.
 */

export type FontWeight = 'regular' | 'bold';
export type FontStyle = 'normal' | 'italic';

export interface FontKey {
  /** Registry family name: 'NotoSans', 'NotoSansTamil', 'NotoSansMono'. */
  readonly family: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

export interface LoadedFont {
  /** The name the PDF renderer registers this face under. */
  readonly id: string;
  readonly family: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly filePath: string;
  readonly font: fontkit.Font;
  /** Units per em, needed to scale glyph advances to points. */
  readonly unitsPerEm: number;
  /** Ascender/descender in font units, for baseline placement. */
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
}

interface FaceDefinition {
  readonly family: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly fileName: string;
}

/**
 * The bundled faces. Deliberately a short list: every extra face is another
 * 500KB in the pkg binary and another thing to get wrong. Weight and style are
 * synthesised no further than this — a template asking for a face that does
 * not exist falls back rather than faux-bolding, because faux bold on a
 * dot-matrix-adjacent invoice looks like a printer fault.
 */
const FACES: readonly FaceDefinition[] = [
  { family: 'NotoSans', bold: false, italic: false, fileName: 'NotoSans-Regular.ttf' },
  { family: 'NotoSans', bold: true, italic: false, fileName: 'NotoSans-Bold.ttf' },
  { family: 'NotoSans', bold: false, italic: true, fileName: 'NotoSans-Italic.ttf' },
  { family: 'NotoSans', bold: true, italic: true, fileName: 'NotoSans-BoldItalic.ttf' },
  { family: 'NotoSansTamil', bold: false, italic: false, fileName: 'NotoSansTamil-Regular.ttf' },
  { family: 'NotoSansTamil', bold: true, italic: false, fileName: 'NotoSansTamil-Bold.ttf' },
  { family: 'NotoSansMono', bold: false, italic: false, fileName: 'NotoSansMono-Regular.ttf' },
  { family: 'NotoSansMono', bold: true, italic: false, fileName: 'NotoSansMono-Bold.ttf' },
];

/** Which family covers which script. */
const FAMILY_FOR_SCRIPT: Record<ScriptTag, Record<string, string>> = {
  // A Tamil run inside a NotoSans paragraph switches to NotoSansTamil; inside a
  // monospace one it has nowhere to go, so it uses the Tamil face too and the
  // grid alignment is lost — which is correct, since Tamil in a character grid
  // is not representable anyway (see the ESC/P renderer's notes).
  tamil: {
    NotoSans: 'NotoSansTamil',
    NotoSansMono: 'NotoSansTamil',
    NotoSansTamil: 'NotoSansTamil',
  },
  latin: { NotoSans: 'NotoSans', NotoSansMono: 'NotoSansMono', NotoSansTamil: 'NotoSans' },
};

export const DEFAULT_FONT_FAMILY = 'NotoSans';
export const MONOSPACE_FONT_FAMILY = 'NotoSansMono';

const faceId = (family: string, bold: boolean, italic: boolean): string =>
  `${family}${bold ? '-Bold' : ''}${italic ? '-Italic' : ''}` || family;

@Injectable()
export class FontRegistry implements OnModuleInit {
  private readonly logger = new Logger(FontRegistry.name);

  private readonly faces = new Map<string, LoadedFont>();

  private fontDirectory = '';

  onModuleInit(): void {
    this.load();
  }

  /** Idempotent, so tests can construct the registry without the Nest lifecycle. */
  load(): void {
    if (this.faces.size > 0) {
      return;
    }

    this.fontDirectory = resolveFontDirectory();

    for (const face of FACES) {
      const filePath = join(this.fontDirectory, face.fileName);

      if (!existsSync(filePath)) {
        this.logger.warn(`Report font missing: ${filePath}`);
        continue;
      }

      try {
        // openSync would re-read on every call in some fontkit versions; read
        // the buffer once and keep the parsed font.
        const parsed = fontkit.create(readFileSync(filePath));
        // A TTC would parse to a collection; the bundled faces are all single
        // fonts, and treating a collection as a font would throw far away from
        // here on the first measurement.
        if (!('unitsPerEm' in parsed)) {
          this.logger.error(`Report font ${face.fileName} is a collection, not a single face`);
          continue;
        }

        const font = parsed;
        const id = faceId(face.family, face.bold, face.italic);

        this.faces.set(id, {
          id,
          family: face.family,
          bold: face.bold,
          italic: face.italic,
          filePath,
          font,
          unitsPerEm: font.unitsPerEm,
          ascent: font.ascent,
          descent: font.descent,
          lineGap: font.lineGap,
        });
      } catch (error) {
        this.logger.error(
          `Failed to load report font ${face.fileName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (this.faces.size === 0) {
      throw new Error(
        `No report fonts could be loaded from ${this.fontDirectory}. ` +
          'Reports cannot render. Check that assets/fonts ships with the build ' +
          '(or set PRINT_FONT_DIR).',
      );
    }

    this.logger.log(`Loaded ${this.faces.size} report font face(s) from ${this.fontDirectory}`);
  }

  get directory(): string {
    return this.fontDirectory;
  }

  /** Every loaded face, for the PDF renderer to register up front. */
  all(): readonly LoadedFont[] {
    return [...this.faces.values()];
  }

  /**
   * Resolve a face, degrading rather than throwing.
   *
   * The order is: exact match, then drop italic, then drop bold, then the
   * default family's regular. A template that asks for a face we do not have
   * still prints — in the wrong weight, which a human notices and reports,
   * unlike a 500 nobody sees until the counter queue backs up.
   */
  resolve(key: FontKey): LoadedFont {
    const family = this.faces.has(faceId(key.family, false, false))
      ? key.family
      : DEFAULT_FONT_FAMILY;

    const candidates = [
      faceId(family, key.bold, key.italic),
      faceId(family, key.bold, false),
      faceId(family, false, key.italic),
      faceId(family, false, false),
      faceId(DEFAULT_FONT_FAMILY, key.bold, key.italic),
      faceId(DEFAULT_FONT_FAMILY, false, false),
    ];

    for (const candidate of candidates) {
      const found = this.faces.get(candidate);
      if (found) {
        return found;
      }
    }

    // load() guarantees at least one face, so this is reachable only if every
    // candidate name is wrong — a programming error, not a data one.
    const [fallback] = this.faces.values();
    return fallback;
  }

  /**
   * The face to draw a run of `script` in, given the element's requested family.
   * This is the Phase 0.2 finding turned into an API.
   */
  resolveForScript(key: FontKey, script: ScriptTag): LoadedFont {
    const requestedFamily = this.faces.has(faceId(key.family, false, false))
      ? key.family
      : DEFAULT_FONT_FAMILY;
    const mapped = FAMILY_FOR_SCRIPT[script][requestedFamily] ?? requestedFamily;
    return this.resolve({ ...key, family: mapped });
  }

  /** Family names a designer may choose from. */
  families(): string[] {
    return [...new Set([...this.faces.values()].map((face) => face.family))].sort();
  }
}

/**
 * Where the fonts live.
 *
 * Search order matters for the three ways this app runs:
 *   1. PRINT_FONT_DIR — an operator override, and how a customer adds a face
 *   2. cwd/assets/fonts — `npm start`, `pm2` with cwd set
 *   3. dist-relative — a built server whose cwd is elsewhere
 *   4. next to the executable — a `pkg` binary
 */
const resolveFontDirectory = (): string => {
  const configured = process.env.PRINT_FONT_DIR?.trim();
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  const candidates = [
    resolve(process.cwd(), 'assets/fonts'),
    resolve(__dirname, '../../../../../../assets/fonts'),
    resolve(__dirname, '../../../../../assets/fonts'),
  ];

  const executableDirectory = (process as NodeJS.Process & { pkg?: unknown }).pkg
    ? resolve(process.execPath, '..', 'assets/fonts')
    : null;
  if (executableDirectory) {
    candidates.unshift(executableDirectory);
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
};
