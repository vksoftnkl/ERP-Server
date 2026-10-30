import { formatDate, formatNumber, formatNumberIntl, groupIndian, groupWestern } from './format';
import { gstExclusive, gstSplit, isInterState } from './gst';
import { integerToIndianWords, numberToIndianWords } from './num-to-words';
import { scalarToString } from './scalar';
import {
  coalesce,
  lower,
  mask,
  padCenter,
  padEnd,
  padStart,
  repeat,
  titleCase,
  trim,
  truncate,
  upper,
  wrapText,
} from './text';

/** What a Prisma Decimal looks like to a transform: an object with a numeric valueOf. */
const decimalLike = (text: string) => ({
  toString: () => text,
  valueOf: () => Number(text),
});

describe('scalarToString', () => {
  it('passes strings through and prints numbers, bigints and booleans', () => {
    expect(scalarToString('abc')).toBe('abc');
    expect(scalarToString(12.5)).toBe('12.5');
    expect(scalarToString(12n)).toBe('12');
    expect(scalarToString(false)).toBe('false');
  });

  it('prints nothing for null and undefined', () => {
    expect(scalarToString(null)).toBe('');
    expect(scalarToString(undefined)).toBe('');
  });

  it('prints a Date as its ISO instant', () => {
    expect(scalarToString(new Date('2026-04-01T00:00:00.000Z'))).toBe('2026-04-01T00:00:00.000Z');
  });

  it('coerces a Decimal-like object through valueOf', () => {
    expect(scalarToString(decimalLike('1234.50'))).toBe('1234.5');
  });

  it('blanks a plain object instead of printing [object Object]', () => {
    expect(scalarToString({ a: 1 })).toBe('');
    expect(scalarToString([1, 2])).toBe('');
  });
});

describe('text transforms', () => {
  it('changes case, and title-cases word by word', () => {
    expect(upper('gst invoice')).toBe('GST INVOICE');
    expect(lower('GST Invoice')).toBe('gst invoice');
    expect(titleCase('sri MURUGAN stores')).toBe('Sri Murugan Stores');
    expect(trim('  x  ')).toBe('x');
  });

  it('treats null as empty text everywhere', () => {
    expect(upper(null)).toBe('');
    expect(padStart(null, 3)).toBe('   ');
    expect(coalesce(null, undefined)).toBe('');
  });

  it('pads to a width, defaulting a blank fill to a space', () => {
    expect(padStart(42, 6, '0')).toBe('000042');
    expect(padEnd('Qty', 6, '.')).toBe('Qty...');
    expect(padStart('x', 3, '')).toBe('  x');
  });

  it('never cuts text already longer than the pad width', () => {
    expect(padStart('INVOICE', 3)).toBe('INVOICE');
    expect(padEnd('INVOICE', 3)).toBe('INVOICE');
    expect(padCenter('INVOICE', 3)).toBe('INVOICE');
  });

  it('truncates a fractional or negative width as a whole, non-negative one', () => {
    expect(padStart('x', 3.9)).toBe('  x');
    expect(padEnd('x', -4)).toBe('x');
    expect(truncate('abcdef', -1)).toBe('');
  });

  it('centres with a custom fill', () => {
    expect(padCenter('ab', 7, '*')).toBe('**ab***');
  });

  it('cuts without an ellipsis when the budget cannot hold one', () => {
    expect(truncate('abcdef', 2, '...')).toBe('ab');
    expect(truncate('abcdef', 3, '...')).toBe('abc');
    expect(truncate('abcdef', 4, '...')).toBe('a...');
  });

  it('caps a repeat at 2000 copies and floors a negative count at zero', () => {
    expect(repeat('-', 3)).toBe('---');
    expect(repeat('-', -2)).toBe('');
    expect(repeat('ab', 5_000)).toHaveLength(4_000);
  });

  it('coalesces to the first non-blank value, trimmed', () => {
    expect(coalesce('  ', '', ' Walk-in ', 'Cash')).toBe('Walk-in');
    expect(coalesce(0, 'fallback')).toBe('0');
  });

  it('wraps to whole words, collapsing runs of whitespace', () => {
    expect(wrapText('Rice   Ponni\n25kg  bag', 10)).toEqual(['Rice Ponni', '25kg bag']);
    expect(wrapText('', 10)).toEqual([]);
    expect(wrapText('   ', 10)).toEqual([]);
  });

  it('treats a width below one as one character a line', () => {
    expect(wrapText('ab', 0)).toEqual(['a', 'b']);
  });

  it('masks all but the last four characters by default', () => {
    expect(mask('33AABCU9603R1ZX')).toBe('XXXXXXXXXXXR1ZX');
    expect(mask('ABCDE12345', 2, '*')).toBe('********45');
    expect(mask('1234')).toBe('1234');
    expect(mask('ABCDEF', 2, '')).toBe('XXXXEF');
  });
});

describe('GST transforms', () => {
  it('rounds an inter-state IGST to the paisa', () => {
    const split = gstSplit(333.33, 18, true);

    expect(split).toEqual({
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 60,
      totalTax: 60,
      interState: true,
    });
  });

  it('gives the odd paisa to SGST so the halves foot to the total', () => {
    // 2.5% of 100.10 is 2.5025: CGST rounds to 2.50, the total to 5.01.
    const split = gstSplit(100.1, 5, false);

    expect(split.cgstAmount).toBe(2.5);
    expect(split.totalTax).toBe(5.01);
    expect(split.sgstAmount).toBe(2.51);
    expect(split.cgstRate).toBe(2.5);
    expect(split.sgstRate).toBe(2.5);
  });

  it('reads a non-numeric taxable value or rate as zero', () => {
    expect(gstSplit('abc', 18).totalTax).toBe(0);
    expect(gstSplit(1000, null).totalTax).toBe(0);
    expect(gstSplit(1000, 'x', true).igstAmount).toBe(0);
  });

  it('accepts numeric strings and a truthy inter-state flag', () => {
    expect(gstSplit('1000', '12', 1)).toMatchObject({ igstAmount: 120, interState: true });
  });

  it('calls a supply intra-state when either side has no GSTIN', () => {
    expect(isInterState('33AABCU9603R1ZX', '')).toBe(false);
    expect(isInterState(null, '29AABCU9603R1ZX')).toBe(false);
  });

  it('compares the two-digit state codes, ignoring surrounding space', () => {
    expect(isInterState(' 33AABCU9603R1ZX', '33ZZZZZ0000Z1Z5')).toBe(false);
    expect(isInterState('33', '29')).toBe(true);
  });

  it('backs the tax out of an inclusive amount and rounds to the paisa', () => {
    expect(gstExclusive(105, 5)).toBe(100);
    expect(gstExclusive(100, 18)).toBe(84.75);
    expect(gstExclusive(100, 0)).toBe(100);
    expect(gstExclusive('abc', 18)).toBe(0);
  });
});

describe('number formatting', () => {
  it('groups negatives without touching the sign', () => {
    expect(groupIndian('-250000')).toBe('-2,50,000');
    expect(groupWestern('-250000')).toBe('-250,000');
    expect(groupIndian('-999')).toBe('-999');
  });

  it('pads to the count of zeros left of the point', () => {
    expect(formatNumber(7, '000')).toBe('007');
    expect(formatNumber(7, '#')).toBe('7');
  });

  it("counts '#' as well as '0' toward the decimals", () => {
    expect(formatNumber(1.5, '0.0#')).toBe('1.50');
  });

  it('defaults to two decimals', () => {
    expect(formatNumber(3)).toBe('3.00');
  });

  it('keeps a plain minus when the pattern has no negative sub-pattern', () => {
    expect(formatNumber(-250000, '#,##0.00')).toBe('-2,50,000.00');
  });

  it('wraps the magnitude in the negative sub-pattern', () => {
    expect(formatNumber(-250000, '#,##0.00;(#,##0.00) Dr')).toBe('(2,50,000.00) Dr');
  });

  it('reads numeric strings and Decimal-like objects', () => {
    expect(formatNumber('1234.5', '#,##0.00')).toBe('1,234.50');
    expect(formatNumber(decimalLike('99.999'), '0.00')).toBe('100.00');
  });

  it('formats Western grouping on request', () => {
    expect(formatNumberIntl(1234567.891, '#,##0.00')).toBe('1,234,567.89');
    expect(formatNumberIntl(5)).toBe('5.00');
  });

  it('prints nothing for blank, infinite or non-numeric input', () => {
    expect(formatNumber('')).toBe('');
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(Infinity)).toBe('');
    expect(formatNumber('12abc')).toBe('');
  });
});

describe('date formatting', () => {
  const instant = new Date('2026-03-05T14:07:09.000Z');

  it('spells month and day names', () => {
    expect(formatDate(instant, 'ddd, dd MMMM yyyy')).toBe('Thu, 05 March 2026');
    expect(formatDate(instant, 'dd-MMM-yy')).toBe('05-Mar-26');
  });

  it('prints 24-hour and 12-hour clocks with the meridiem', () => {
    expect(formatDate(instant, 'HH:mm:ss')).toBe('14:07:09');
    expect(formatDate(instant, 'hh:mm tt')).toBe('02:07 PM');
    expect(formatDate(new Date('2026-03-05T00:30:00.000Z'), 'hh:mm tt')).toBe('12:30 AM');
    expect(formatDate(new Date('2026-03-05T12:00:00.000Z'), 'hh tt')).toBe('12 PM');
  });

  it('copies characters that are not tokens', () => {
    expect(formatDate(instant, 'Bill dt: dd/MM/yyyy')).toBe('Bill dt: 05/03/2026');
  });

  it('defaults to dd-MM-yyyy', () => {
    expect(formatDate(instant)).toBe('05-03-2026');
  });

  it('accepts an epoch number and an ISO string', () => {
    expect(formatDate(0, 'yyyy-MM-dd')).toBe('1970-01-01');
    expect(formatDate('2026-12-31T23:59:59Z', 'dd-MM-yyyy HH:mm')).toBe('31-12-2026 23:59');
  });

  it('prints nothing for an invalid Date, blank text or a non-date value', () => {
    expect(formatDate(new Date('nope'))).toBe('');
    expect(formatDate('   ')).toBe('');
    expect(formatDate(true)).toBe('');
    expect(formatDate(null)).toBe('');
  });
});

describe('amount in words', () => {
  it('voices every Indian group at once', () => {
    expect(integerToIndianWords(99_99_99_999)).toBe(
      'Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred and Ninety Nine',
    );
    expect(integerToIndianWords(1_01_01_101)).toBe(
      'One Crore One Lakh One Thousand One Hundred and One',
    );
  });

  it('voices hundreds of crore in the crore group', () => {
    expect(integerToIndianWords(250_00_00_000)).toBe('Two Hundred and Fifty Crore');
  });

  it('drops the fraction and the sign of what it is given', () => {
    expect(integerToIndianWords(-12.9)).toBe('Twelve');
  });

  it('voices round tens without a trailing one', () => {
    expect(integerToIndianWords(40)).toBe('Forty');
    expect(integerToIndianWords(1_10_000)).toBe('One Lakh Ten Thousand');
  });

  it('lets the caller rename or drop the currency words and the terminator', () => {
    expect(numberToIndianWords(10.5, { currency: 'Dollars', subCurrency: 'Cents' })).toBe(
      'Dollars Ten and Cents Fifty Only',
    );
    expect(numberToIndianWords(10.5, { currency: '', subCurrency: '', only: false })).toBe(
      'Ten and Fifty',
    );
  });

  it('voices the precision it is told to', () => {
    expect(numberToIndianWords(12.75, { decimals: 0 })).toBe('Rupees Thirteen Only');
    expect(numberToIndianWords(1.005, { decimals: 3, subCurrency: 'Grams' })).toBe(
      'Rupees One and Grams Five Only',
    );
  });

  it('reads numeric strings and Decimal-like objects', () => {
    expect(numberToIndianWords('2500')).toBe('Rupees Two Thousand Five Hundred Only');
    expect(numberToIndianWords(decimalLike('100.10'))).toBe(
      'Rupees One Hundred and Paise Ten Only',
    );
  });

  it('prints nothing for a value that is not a number', () => {
    expect(numberToIndianWords('twelve')).toBe('');
    expect(numberToIndianWords(Number.NaN)).toBe('');
  });
});
