import { Injectable, Logger } from '@nestjs/common';
// Root import, not 'bwip-js/node': this tsconfig uses moduleResolution 'node',
// which ignores the package's exports map. The root "main" already points at
// the Node build, and TypeScript picks up dist/bwip-js-node.d.ts beside it.
import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import { BarcodeSymbology } from '../../templates/dto/template-definition.schema';

/**
 * Barcode and QR generation.
 *
 * Both produce PNG buffers, which is what the PDF renderer embeds. Generation
 * is cached by (symbology, value, size): a picking list prints the same item
 * barcode on every line, and bwip-js is a PostScript interpreter -- not
 * something to run 200 times for the same input.
 *
 * The e-invoice signed QR is the reason `errorCorrection` is exposed. That
 * payload is a JWS of around 1KB; at error-correction level H it needs a
 * version-40 symbol whose modules are too fine for a 58mm thermal head to
 * resolve. M is the practical default and L is sometimes necessary.
 */

/** bwip-js symbology names, which differ from the friendly ones. */
const BWIPP_NAMES: Record<BarcodeSymbology, string> = {
  code128: 'code128',
  ean13: 'ean13',
  ean8: 'ean8',
  upca: 'upca',
  code39: 'code39',
  itf14: 'itf14',
};

/**
 * Symbologies with a fixed digit count and a check digit. bwip-js throws on a
 * bad payload, which would abort a whole invoice over one malformed EAN in the
 * item master -- so they are validated first and skipped with a warning.
 */
const FIXED_LENGTH: Partial<Record<BarcodeSymbology, { digits: number; label: string }>> = {
  ean13: { digits: 13, label: 'EAN-13' },
  ean8: { digits: 8, label: 'EAN-8' },
  upca: { digits: 12, label: 'UPC-A' },
  itf14: { digits: 14, label: 'ITF-14' },
};

export interface GeneratedImage {
  readonly png: Buffer;
  readonly widthPx: number;
  readonly heightPx: number;
}

const MAX_CACHE_ENTRIES = 500;

/** Render at 8x the point size so a 300 dpi printer has pixels to work with. */
const RASTER_SCALE = 8;

@Injectable()
export class BarcodeFactory {
  private readonly logger = new Logger(BarcodeFactory.name);

  private readonly cache = new Map<string, GeneratedImage>();

  private readonly warnings = new Set<string>();

  /** Warnings accumulated since the last drain, for the render result. */
  drainWarnings(): string[] {
    const drained = [...this.warnings];
    this.warnings.clear();
    return drained;
  }

  async barcode(
    symbology: BarcodeSymbology,
    value: string,
    widthMm: number,
    heightMm: number,
    showText: boolean,
  ): Promise<GeneratedImage | null> {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const problem = this.validate(symbology, trimmed);
    if (problem) {
      this.warnings.add(problem);
      return null;
    }

    const cacheKey = `bc|${symbology}|${trimmed}|${widthMm.toFixed(2)}|${heightMm.toFixed(2)}|${showText}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const png = await bwipjs.toBuffer({
        bcid: BWIPP_NAMES[symbology],
        text: trimmed,
        // bwip-js sizes in millimetres natively when scaleX/scaleY are given in
        // its own units; asking for the height in mm and letting it choose the
        // width keeps the bar module width legal for the symbology. A barcode
        // squeezed to an arbitrary box is a barcode a scanner refuses.
        height: Math.max(4, heightMm),
        includetext: showText,
        textxalign: 'center',
        paddingwidth: 0,
        paddingheight: 0,
        scale: 3,
      });

      const generated: GeneratedImage = {
        png: Buffer.from(png),
        widthPx: 0,
        heightPx: 0,
      };

      this.store(cacheKey, generated);
      return generated;
    } catch (error) {
      const message = `Barcode ${symbology} '${trimmed}' could not be generated: ${
        error instanceof Error ? error.message : String(error)
      }`;
      this.warnings.add(message);
      this.logger.warn(message);
      return null;
    }
  }

  async qrcode(
    value: string,
    sizeMm: number,
    errorCorrection: 'L' | 'M' | 'Q' | 'H',
  ): Promise<GeneratedImage | null> {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const cacheKey = `qr|${trimmed}|${sizeMm.toFixed(2)}|${errorCorrection}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const pixels = Math.max(64, Math.round(sizeMm * RASTER_SCALE));
      const png = await QRCode.toBuffer(trimmed, {
        type: 'png',
        errorCorrectionLevel: errorCorrection,
        width: pixels,
        // No quiet-zone margin: the template controls spacing, and QR's default
        // 4-module margin inside a 25mm box costs a quarter of the symbol.
        margin: 0,
      });

      const generated: GeneratedImage = { png, widthPx: pixels, heightPx: pixels };
      this.store(cacheKey, generated);
      return generated;
    } catch (error) {
      const message = `QR code could not be generated: ${
        error instanceof Error ? error.message : String(error)
      }`;
      this.warnings.add(message);
      this.logger.warn(message);
      return null;
    }
  }

  /**
   * Reject a payload a fixed-length symbology cannot carry, BEFORE bwip-js
   * throws. An item master with one malformed EAN must not take down the
   * invoice it appears on.
   */
  private validate(symbology: BarcodeSymbology, value: string): string | null {
    const fixed = FIXED_LENGTH[symbology];
    if (!fixed) {
      return null;
    }

    if (!/^\d+$/.test(value)) {
      return `${fixed.label} requires digits only, got '${value}'`;
    }

    // bwip-js accepts the payload one digit short and computes the check digit,
    // which is the common case for an EAN stored without it.
    if (value.length !== fixed.digits && value.length !== fixed.digits - 1) {
      return `${fixed.label} requires ${fixed.digits} digits, got ${value.length} ('${value}')`;
    }

    return null;
  }

  private store(key: string, image: GeneratedImage): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      // Simple FIFO eviction. A barcode cache does not need LRU: within one
      // render the working set is the document's distinct item codes, and
      // across renders any hit at all is a bonus.
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, image);
  }
}
