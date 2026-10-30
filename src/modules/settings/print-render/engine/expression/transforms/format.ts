import { scalarToString } from './scalar';
/**
 * Numeric and date formatting for template expressions.
 *
 * The pattern language is the one every ERP user already knows from Excel and
 * Tally, restricted to what a report actually needs:
 *
 *   '0.00'        -> 1234.5   becomes '1234.50'
 *   '#,##0.00'    -> 1234.5   becomes '1,234.50'   (Indian grouping, see below)
 *   '0.000'       -> 12.5     becomes '12.500'
 *   '#,##0'       -> 250000   becomes '2,50,000'
 *   '0.00;(0.00)' -> -5       becomes '(5.00)'     (accounting negatives)
 *   'dd-MM-yyyy'  -> a Date   becomes '24-08-2026'
 *
 * Grouping is INDIAN by default: last three digits, then pairs. 2,50,000 not
 * 250,000. This is not a preference — a GST invoice showing 250,000 reads as
 * wrong to the person signing it. `fmtIntl` is available for the rare export
 * that genuinely needs Western grouping.
 */

/** Insert Indian digit grouping: 12,34,56,789. */
export const groupIndian = (wholeDigits: string): string => {
  const negative = wholeDigits.startsWith('-');
  const digits = negative ? wholeDigits.slice(1) : wholeDigits;

  if (digits.length <= 3) {
    return negative ? `-${digits}` : digits;
  }

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  // Every group above the last three is a pair.
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const result = `${grouped},${lastThree}`;
  return negative ? `-${result}` : result;
};

/** Insert Western digit grouping: 123,456,789. */
export const groupWestern = (wholeDigits: string): string => {
  const negative = wholeDigits.startsWith('-');
  const digits = negative ? wholeDigits.slice(1) : wholeDigits;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return negative ? `-${grouped}` : grouped;
};

interface ParsedNumberPattern {
  readonly decimals: number;
  readonly grouped: boolean;
  /** Minimum integer digits, from the count of '0' left of the decimal point. */
  readonly minIntegerDigits: number;
}

const parseNumberPattern = (pattern: string): ParsedNumberPattern => {
  const [wholePart, fractionPart = ''] = pattern.split('.');
  return {
    decimals: (fractionPart.match(/[0#]/g) ?? []).length,
    grouped: wholePart.includes(','),
    minIntegerDigits: (wholePart.match(/0/g) ?? []).length,
  };
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  // Prisma Decimal coerces exactly through Number() via valueOf.
  const numeric = typeof value === 'number' ? value : Number(scalarToString(value));
  return Number.isFinite(numeric) ? numeric : null;
};

const applyNumberPattern = (
  value: number,
  pattern: string,
  group: (digits: string) => string,
): string => {
  const { decimals, grouped, minIntegerDigits } = parseNumberPattern(pattern);

  // toFixed rounds half-away-from-zero for positives, which is what invoice
  // arithmetic expects; guard the -0 that appears when a tiny negative rounds.
  const fixed = value.toFixed(decimals);
  const normalised = Object.is(Number(fixed), -0) ? (0).toFixed(decimals) : fixed;

  const negative = normalised.startsWith('-');
  const unsigned = negative ? normalised.slice(1) : normalised;
  const [whole, fraction] = unsigned.split('.');

  const padded = whole.padStart(Math.max(minIntegerDigits, 1), '0');
  const wholeOut = grouped ? group(padded) : padded;
  const body = fraction ? `${wholeOut}.${fraction}` : wholeOut;

  return negative ? `-${body}` : body;
};

/**
 * Format a number. A pattern may carry a `;` and a negative sub-pattern, which
 * is how accounting parentheses are expressed: '#,##0.00;(#,##0.00)'.
 */
export const formatNumber = (
  value: unknown,
  pattern = '0.00',
  group: (digits: string) => string = groupIndian,
): string => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return '';
  }

  const [positivePattern, negativePattern] = String(pattern).split(';');

  if (numeric < 0 && negativePattern) {
    // The negative sub-pattern supplies its own sign presentation, so the
    // magnitude goes in unsigned.
    const formatted = applyNumberPattern(Math.abs(numeric), negativePattern, group);
    return negativePattern.replace(/[#0.,]+/, formatted);
  }

  return applyNumberPattern(numeric, positivePattern, group);
};

/** Western-grouped variant, for exports that must not use lakh/crore. */
export const formatNumberIntl = (value: unknown, pattern = '0.00'): string =>
  formatNumber(value, pattern, groupWestern);

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTH_NAMES_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/**
 * Format a date with a `dd-MM-yyyy`-style pattern.
 *
 * Always read in UTC. A report is a record of what the server stored, and
 * shifting an invoice date by the render machine's timezone is how a bill dated
 * the 1st prints as the 31st of the previous month — and lands in the wrong GST
 * return period.
 */
export const formatDate = (value: unknown, pattern = 'dd-MM-yyyy'): string => {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  const pad = (input: number, width = 2): string => String(input).padStart(width, '0');
  const hours24 = date.getUTCHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  // Longest tokens first, so 'yyyy' is not consumed as two 'yy'.
  const replacements: Array<[string, string]> = [
    ['yyyy', String(date.getUTCFullYear())],
    ['yy', pad(date.getUTCFullYear() % 100)],
    ['MMMM', MONTH_NAMES_LONG[date.getUTCMonth()]],
    ['MMM', MONTH_NAMES_SHORT[date.getUTCMonth()]],
    ['MM', pad(date.getUTCMonth() + 1)],
    ['ddd', DAY_NAMES_SHORT[date.getUTCDay()]],
    ['dd', pad(date.getUTCDate())],
    ['HH', pad(hours24)],
    ['hh', pad(hours12)],
    ['mm', pad(date.getUTCMinutes())],
    ['ss', pad(date.getUTCSeconds())],
    ['tt', hours24 < 12 ? 'AM' : 'PM'],
  ];

  let output = '';
  let cursor = 0;
  outer: while (cursor < pattern.length) {
    for (const [token, replacement] of replacements) {
      if (pattern.startsWith(token, cursor)) {
        output += replacement;
        cursor += token.length;
        continue outer;
      }
    }
    output += pattern[cursor];
    cursor += 1;
  }

  return output;
};
