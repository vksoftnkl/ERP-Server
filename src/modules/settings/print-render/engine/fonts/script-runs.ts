/**
 * Splitting a string into runs that can each be drawn with one font.
 *
 * This exists because of the Phase 0.2 spike result: PDFKit shapes Tamil
 * correctly, but NotoSansTamil carries NO Latin glyphs. Drawing
 * `Sugar சர்க்கரை 1kg` with the Tamil face replaces every Latin character with
 * a .notdef box — silently, with no error anywhere. A single-font draw is
 * therefore never correct for this application's data, since item names are
 * routinely bilingual (inventory.item_master carries item_name_en AND
 * item_name_ta).
 *
 * The split is coarse on purpose. It is not a Unicode bidi or itemisation
 * implementation; it is "which of our two faces covers this character", which
 * is the only question the renderer actually has.
 */

export type ScriptTag = 'tamil' | 'latin';

export interface ScriptRun {
  readonly script: ScriptTag;
  readonly text: string;
}

/** Tamil (U+0B80-U+0BFF) and Tamil Supplement (U+11FC0-U+11FFF). */
export const isTamilCodePoint = (codePoint: number): boolean =>
  (codePoint >= 0x0b80 && codePoint <= 0x0bff) || (codePoint >= 0x11fc0 && codePoint <= 0x11fff);

/**
 * Characters that belong to whichever run they find themselves in.
 *
 * Space, digits and common punctuation are covered by both faces, so starting a
 * new run at every space would shatter `1 கிலோ பாக்கெட்` into five runs and
 * five draw calls. Worse, it would let a space between two Tamil words be laid
 * out by the Latin face, whose advance width differs — visibly shifting the
 * text. Neutrals attach to the current run instead.
 */
const isNeutralCodePoint = (codePoint: number): boolean =>
  codePoint === 0x20 || // space
  codePoint === 0x09 || // tab
  (codePoint >= 0x30 && codePoint <= 0x39) || // digits
  codePoint === 0x2c || // ,
  codePoint === 0x2e || // .
  codePoint === 0x2d || // -
  codePoint === 0x2f || // /
  codePoint === 0x3a || // :
  codePoint === 0x3b || // ;
  codePoint === 0x28 || // (
  codePoint === 0x29 || // )
  codePoint === 0x25 || // %
  codePoint === 0x2b || // +
  codePoint === 0x23; // #

/**
 * Split `text` into consecutive single-script runs.
 *
 * Always returns at least one run for a non-empty string, and the concatenated
 * run texts always equal the input exactly — the renderer relies on that to
 * position each run by measuring the ones before it.
 */
export const splitScriptRuns = (text: string): ScriptRun[] => {
  if (!text) {
    return [];
  }

  const runs: Array<{ script: ScriptTag; text: string }> = [];

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    const script: ScriptTag = isTamilCodePoint(codePoint) ? 'tamil' : 'latin';
    const last = runs[runs.length - 1];

    if (last && (isNeutralCodePoint(codePoint) || last.script === script)) {
      last.text += character;
      continue;
    }

    runs.push({ script, text: character });
  }

  return runs;
};

/** True when the string contains any character needing the complex-script face. */
export const containsComplexScript = (text: string): boolean => {
  for (const character of text) {
    if (isTamilCodePoint(character.codePointAt(0) ?? 0)) {
      return true;
    }
  }
  return false;
};
