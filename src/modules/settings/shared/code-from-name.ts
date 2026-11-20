/**
 * Codes made from a name when the user leaves the Code box blank. One home for
 * the Company rule (plan C1, 18/11/2026) and the HR masters (review step 5,
 * 20/11/2026): Department and Employee take initials, Designation the whole
 * name (the driver list matches the code DRIVER, so initials would empty it).
 *
 * The generators only make the BASE. The caller reads the codes already taken
 * that start with it (nextFreeCode) under lockCodeSeries, so two saves never
 * pick the same one; the unique indexes stay the last word.
 */

/** How an initials code is made. */
export interface InitialsCodeRule {
  /** Whole words left out (upper case, after A-Z 0-9 stripping). */
  readonly skipWords: ReadonlySet<string>;
  /** Padded up to this many with the next letters of the first word, then the next ones. */
  readonly minLength: number;
  /** At most this many initials. */
  readonly maxLength: number;
}

/** Plan C1 — the Company code (and, by review step 5, the Department code). */
export const COMPANY_CODE_RULE: InitialsCodeRule = {
  skipWords: new Set(['PRIVATE', 'PVT', 'LIMITED', 'LTD', 'THE', 'AND', '&']),
  minLength: 3,
  maxLength: 6,
};

/** Review step 5 — Department codes follow the Company rule as it is. */
export const DEPARTMENT_CODE_RULE: InitialsCodeRule = COMPANY_CODE_RULE;

/**
 * Review step 5 — Employee codes: a person's initials, 3 to 6, padded as the
 * Company rule pads. No skip words: they are words of firm names.
 * Suresh Krishna → SKU, RAMESH → RAM.
 */
export const EMPLOYEE_CODE_RULE: InitialsCodeRule = {
  skipWords: new Set(),
  minLength: 3,
  maxLength: 6,
};

/** Review step 5 — the longest code a designation name makes. */
export const DESIGNATION_CODE_MAX_LENGTH = 20;

/** A name's words, upper case, each kept to A-Z 0-9; empty words dropped. */
function wordsOf(name: string): string[] {
  return name
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
}

/**
 * The initials of a name's words (skip words left out unless the name is made
 * of nothing else), at most `maxLength`, padded to at least `minLength` with
 * the next letters of the first word, then of the next ones. "MT Demo Traders"
 * → MDT, "SUGI TRADERS" → STU, "Om" → OM (nothing left to pad with). null when
 * the name holds no A-Z / 0-9 at all.
 */
export function initialsCode(name: string, rule: InitialsCodeRule): string | null {
  const words = wordsOf(name);
  const kept = words.filter((word) => !rule.skipWords.has(word));
  // A name made of skip words only ("The Limited") still gets a code.
  const source = kept.length ? kept : words;
  if (!source.length) {
    return null;
  }
  let code = source
    .map((word) => word[0])
    .join('')
    .slice(0, rule.maxLength);
  for (const word of source) {
    for (let i = 1; i < word.length && code.length < rule.minLength; i++) {
      code += word[i];
    }
    if (code.length >= rule.minLength) {
      break;
    }
  }
  return code;
}

/**
 * The whole name, upper case, letters and digits only, at most `maxLength`:
 * Driver → DRIVER, Sales Manager → SALESMANAGER. null when nothing is left.
 */
export function wholeNameCode(name: string, maxLength: number): string | null {
  const code = wordsOf(name).join('').slice(0, maxLength);
  return code || null;
}

/**
 * `base`, else base2, base3 … — the first one no taken code equals in any
 * case. `taken` is what the caller read (codes starting with `base`, any
 * case); nulls are ignored. The suffix may take the code past the base's
 * maximum, as the Company code always has (SSSLEI2).
 */
export function firstFreeCode(base: string, taken: Iterable<string | null>): string {
  const used = new Set<string>();
  for (const code of taken) {
    if (code) {
      used.add(code.trim().toUpperCase());
    }
  }
  let code = base;
  for (let n = 2; used.has(code.toUpperCase()); n++) {
    code = `${base}${n}`;
  }
  return code;
}

/**
 * The code a row created without one gets: firstFreeCode() of `base` among
 * the codes `takenStartingWith(base)` reads. null when the name made no base.
 */
export async function nextFreeCode(
  base: string | null,
  takenStartingWith: (base: string) => Promise<ReadonlyArray<string | null>>,
): Promise<string | null> {
  if (!base) {
    return null;
  }
  return firstFreeCode(base, await takenStartingWith(base));
}
