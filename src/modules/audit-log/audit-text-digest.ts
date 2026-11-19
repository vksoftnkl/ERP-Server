import { createHash } from 'node:crypto';

/**
 * What the audit keeps of a stylesheet (review list 11-19, 266.1): its SHA-256 (hex of the
 * UTF-8 bytes), its UTF-8 size and its line count — never the text. The App Theme service
 * writes it on a template save; the history read turns an older row's whole text into the
 * same three values, so old and new rows read alike.
 */
export function stylesheetDigest(text: string): {
  stylesheetHash: string;
  stylesheetSize: number;
  stylesheetLines: number;
} {
  return {
    stylesheetHash: createHash('sha256').update(text, 'utf8').digest('hex'),
    stylesheetSize: Buffer.byteLength(text, 'utf8'),
    stylesheetLines: text.length === 0 ? 0 : text.split('\n').length,
  };
}
