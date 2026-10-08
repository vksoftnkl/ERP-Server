/**
 * String transforms for template expressions.
 *
 * `pad`, `truncate` and `repeat` matter far more in GRID mode than in GRAPHIC:
 * on a dot-matrix printer the column budget is absolute, and a template author
 * has no font metrics to fall back on. These are the tools that make a
 * character-grid invoice line up.
 */

/**
 * Convert an unknown to text without tripping no-base-to-string.
 *
 * The lint rule distrusts any `.toString()` on an object type. Number() is
 * rule-safe and, for a Prisma Decimal, coerces exactly through valueOf; a plain
 * object yields NaN and becomes empty rather than '[object Object]' on the face
 * of a document.
 */
const asText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : '';
};

export const upper = (value: unknown): string => asText(value).toUpperCase();
export const lower = (value: unknown): string => asText(value).toLowerCase();
export const trim = (value: unknown): string => asText(value).trim();

export const titleCase = (value: unknown): string =>
  asText(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());

/** Left-pad to `width`. Longer input is returned untouched, not silently cut. */
export const padStart = (value: unknown, width: number, fill = ' '): string =>
  asText(value).padStart(Math.max(0, Math.trunc(width)), fill || ' ');

export const padEnd = (value: unknown, width: number, fill = ' '): string =>
  asText(value).padEnd(Math.max(0, Math.trunc(width)), fill || ' ');

/** Centre within `width`; extra space favours the right, as monospace expects. */
export const padCenter = (value: unknown, width: number, fill = ' '): string => {
  const text = asText(value);
  const target = Math.max(0, Math.trunc(width));
  if (text.length >= target) {
    return text;
  }
  const totalPad = target - text.length;
  const left = Math.floor(totalPad / 2);
  const filler = fill || ' ';
  return filler.repeat(left) + text + filler.repeat(totalPad - left);
};

/** Hard cut to `width`, optionally with a trailing ellipsis inside the budget. */
export const truncate = (value: unknown, width: number, ellipsis = ''): string => {
  const text = asText(value);
  const target = Math.max(0, Math.trunc(width));
  if (text.length <= target) {
    return text;
  }
  if (!ellipsis || target <= ellipsis.length) {
    return text.slice(0, target);
  }
  return text.slice(0, target - ellipsis.length) + ellipsis;
};

export const repeat = (value: unknown, count: number): string =>
  asText(value).repeat(Math.max(0, Math.min(2_000, Math.trunc(count))));

/** Coalesce to the first non-blank of the arguments. */
export const coalesce = (value: unknown, ...fallbacks: unknown[]): string => {
  const candidates = [value, ...fallbacks];
  for (const candidate of candidates) {
    const text = asText(candidate).trim();
    if (text) {
      return text;
    }
  }
  return '';
};

/**
 * Greedy word wrap to a character width. Used by the GRID renderers and by the
 * GRAPHIC text measurer's monospace path.
 */
export const wrapText = (value: unknown, width: number): string[] => {
  const text = asText(value).replace(/\s+/g, ' ').trim();
  const target = Math.max(1, Math.trunc(width));

  if (!text) {
    return [];
  }

  const lines: string[] = [];
  let current = '';

  for (const word of text.split(' ')) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= target) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }

    // A single word longer than the line has to be broken mid-word; leaving it
    // to overflow would push every following column out of alignment.
    while (current.length > target) {
      lines.push(current.slice(0, target));
      current = current.slice(target);
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

/** Mask all but the last `visible` characters — GSTIN/PAN on customer copies. */
export const mask = (value: unknown, visible = 4, maskChar = 'X'): string => {
  const text = asText(value);
  const keep = Math.max(0, Math.trunc(visible));
  if (text.length <= keep) {
    return text;
  }
  return (maskChar || 'X').repeat(text.length - keep) + text.slice(-keep);
};
