/**
 * Single-byte code page encoding for the raw renderers.
 *
 * ── Why this is a hard limit, not a rough edge ───────────────────────────────
 * A dot-matrix or thermal printer in TEXT mode has a ROM character generator:
 * it can print the ~250 glyphs its selected code page defines, and nothing
 * else. There is no font to embed. Tamil is therefore not printable in text
 * mode at all — not badly, not approximately, not at all.
 *
 * The alternative is graphics mode, which rasterises the page and sends it as
 * bitmap columns. On a 9-pin dot matrix that turns a 2-second invoice into a
 * 40-second one, which is precisely the speed advantage that makes these
 * printers worth supporting. So the position this module takes is:
 *
 *   * Encode what the code page has.
 *   * Transliterate what has a sensible ASCII equivalent (₹ -> Rs.).
 *   * Replace the rest with a substitute character AND report it, naming the
 *     characters that were lost.
 *
 * That last part matters. Silently dropping a customer's Tamil name produces an
 * invoice that looks fine to the server and is unusable at the counter. A
 * warning lets the print API tell the operator to use the PDF path instead.
 */

export type CodepageName = 'CP437' | 'CP850' | 'CP1252' | 'ASCII';

/**
 * CP437 high range (0x80-0xFF), the IBM PC set almost every ESC/P printer
 * defaults to. Exactly 128 characters, index 0 = byte 0x80.
 */
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
  'áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

/**
 * CP850 high range — CP437 with the box-drawing block partly replaced by more
 * Western European accented letters. The set TVS and Epson printers sold in
 * India commonly ship as an alternative.
 */
const CP850_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒ' +
  'áíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀' +
  'ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

/** CP1252 high range — Latin-1 plus the Windows specials at 0x80-0x9F. */
const CP1252_HIGH =
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ' +
  '‘’“”•–—˜™š›œžŸ' +
  ' ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿' +
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ';

const HIGH_RANGES: Record<CodepageName, string> = {
  CP437: CP437_HIGH,
  CP850: CP850_HIGH,
  CP1252: CP1252_HIGH,
  ASCII: '',
};

/**
 * Transliterations applied BEFORE code page lookup.
 *
 * Every entry here is a character that appears in real ERP data and has an
 * unambiguous ASCII equivalent. The rupee sign is the important one: it is
 * absent from CP437 and CP1252 alike (CP437 has the old ₧ peseta sign at 0x9E,
 * not ₹), so without this every amount column on a thermal receipt would carry
 * a substitute character.
 */
const TRANSLITERATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/₹/g, 'Rs.'],
  [/[‘’‛]/g, "'"],
  [/[“”‟]/g, '"'],
  [/[–—―]/g, '-'],
  [/…/g, '...'],
  [/ /g, ' '],
  [/•/g, '*'],
  [/×/g, 'x'],
  [/₹/g, 'Rs.'],
  // Combining marks left over from a decomposition have no width of their own
  // and would each consume a character cell.
  [/[̀-ͯ]/g, ''],
];

export interface EncodeResult {
  readonly bytes: Buffer;
  /** Characters that had no representation, deduplicated. */
  readonly unmapped: readonly string[];
}

/** Byte written where a character has no representation. */
const SUBSTITUTE_BYTE = 0x3f; // '?'

export class Codepage {
  private readonly reverse: Map<number, number>;

  constructor(readonly name: CodepageName) {
    this.reverse = buildReverseMap(name);
  }

  /**
   * Encode text to single-byte output.
   *
   * The returned byte length always equals the transliterated character count,
   * which is what keeps a character grid aligned: a substitution must occupy
   * exactly one cell, and a transliteration that changes length (₹ -> Rs.)
   * must be applied by `prepare` BEFORE the grid measures the string.
   */
  encode(text: string): EncodeResult {
    const prepared = Codepage.prepare(text);
    const bytes = Buffer.alloc(prepared.length);
    const unmapped = new Set<string>();

    let cursor = 0;
    for (const character of prepared) {
      const codePoint = character.codePointAt(0) ?? 0;

      if (codePoint < 0x80) {
        // Control characters other than tab would be read as commands.
        bytes[cursor] = codePoint < 0x20 && codePoint !== 0x09 ? 0x20 : codePoint;
        cursor += 1;
        continue;
      }

      const mapped = this.reverse.get(codePoint);
      if (mapped !== undefined) {
        bytes[cursor] = mapped;
        cursor += 1;
        continue;
      }

      bytes[cursor] = SUBSTITUTE_BYTE;
      cursor += 1;
      unmapped.add(character);
    }

    // A surrogate pair is two JS characters but one code point, so the buffer
    // may be shorter than allocated.
    return { bytes: bytes.subarray(0, cursor), unmapped: [...unmapped] };
  }

  /** True when every character can be represented. */
  covers(text: string): boolean {
    return this.encode(text).unmapped.length === 0;
  }

  /**
   * Apply transliterations. MUST be run before a string is measured against a
   * column budget, because '₹' becomes three cells.
   */
  static prepare(text: string): string {
    let prepared = text.normalize('NFC');
    for (const [pattern, replacement] of TRANSLITERATIONS) {
      prepared = prepared.replace(pattern, replacement);
    }
    return prepared;
  }
}

const buildReverseMap = (name: CodepageName): Map<number, number> => {
  const reverse = new Map<number, number>();
  const high = HIGH_RANGES[name];

  for (let index = 0; index < high.length; index += 1) {
    const codePoint = high.codePointAt(index);
    if (codePoint === undefined) {
      continue;
    }
    // First definition wins, so a code page that lists a character twice maps
    // to its lower byte.
    if (!reverse.has(codePoint)) {
      reverse.set(codePoint, 0x80 + index);
    }
  }

  return reverse;
};

const codepageCache = new Map<string, Codepage>();

/** Resolve a code page by name, defaulting to CP437 for an unknown one. */
export const getCodepage = (name: string | null | undefined): Codepage => {
  const normalised = (name ?? 'CP437').trim().toUpperCase();
  const resolved: CodepageName = normalised in HIGH_RANGES ? (normalised as CodepageName) : 'CP437';

  const cached = codepageCache.get(resolved);
  if (cached) {
    return cached;
  }

  const codepage = new Codepage(resolved);
  codepageCache.set(resolved, codepage);
  return codepage;
};

/**
 * Detect text that cannot be printed in TEXT mode at all, whatever code page is
 * selected — i.e. a complex script. Reported as its own warning because the
 * remedy is different: not a code page change, but the PDF path.
 */
export const findUnprintableScripts = (text: string): string[] => {
  const scripts = new Set<string>();
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0x0b80 && codePoint <= 0x0bff) {
      scripts.add('Tamil');
    } else if (codePoint >= 0x0900 && codePoint <= 0x097f) {
      scripts.add('Devanagari');
    } else if (codePoint >= 0x0c00 && codePoint <= 0x0c7f) {
      scripts.add('Telugu');
    } else if (codePoint >= 0x0c80 && codePoint <= 0x0cff) {
      scripts.add('Kannada');
    } else if (codePoint >= 0x0d00 && codePoint <= 0x0d7f) {
      scripts.add('Malayalam');
    }
  }
  return [...scripts];
};
