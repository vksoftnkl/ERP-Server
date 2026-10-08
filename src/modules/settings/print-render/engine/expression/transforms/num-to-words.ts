/**
 * Indian-format number to words.
 *
 * "Rupees Two Lakh Fifty Thousand Only" — mandatory content on a GST tax
 * invoice, and the reason a Western thousands/millions implementation is not
 * merely a style difference but a compliance failure.
 *
 * Scale: units, thousand, lakh (10^5), crore (10^7), and beyond that the
 * convention repeats — arab (10^9) is written "one thousand crore" on invoices,
 * so that is what this produces rather than inventing arab/kharab.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0-99 in words. */
const twoDigitsToWords = (value: number): string => {
  if (value < 20) {
    return ONES[value];
  }
  const tens = TENS[Math.floor(value / 10)];
  const ones = ONES[value % 10];
  return ones ? `${tens} ${ones}` : tens;
};

/** 0-999 in words. */
const threeDigitsToWords = (value: number): string => {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const parts: string[] = [];

  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }
  if (remainder > 0) {
    // "One Hundred and Five" is the form used on Indian invoices.
    parts.push(hundreds > 0 ? `and ${twoDigitsToWords(remainder)}` : twoDigitsToWords(remainder));
  }

  return parts.join(' ');
};

/**
 * A whole number in Indian words, no currency wrapper.
 * 250000 -> 'Two Lakh Fifty Thousand'
 */
export const integerToIndianWords = (value: number): string => {
  const whole = Math.floor(Math.abs(value));

  if (whole === 0) {
    return 'Zero';
  }

  // Split into the Indian groups: crore | lakh | thousand | hundreds.
  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1_000);
  const rest = whole % 1_000;

  const parts: string[] = [];

  if (crore > 0) {
    // Above 999 crore the convention keeps counting crore rather than
    // introducing arab, so recurse on the crore count itself.
    parts.push(`${crore > 999 ? integerToIndianWords(crore) : threeDigitsToWords(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  }
  if (rest > 0) {
    parts.push(threeDigitsToWords(rest));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

export interface NumToWordsOptions {
  /** Currency name for the whole part. '' suppresses the prefix entirely. */
  readonly currency?: string;
  /** Name for the fractional part. */
  readonly subCurrency?: string;
  /** Append 'Only', the standard invoice terminator. */
  readonly only?: boolean;
  /** Fractional digits to voice. 2 for paise. */
  readonly decimals?: number;
}

/**
 * The invoice-ready form.
 *
 * 250000    -> 'Rupees Two Lakh Fifty Thousand Only'
 * 1234.56   -> 'Rupees One Thousand Two Hundred and Thirty Four and Paise Fifty Six Only'
 * -500      -> 'Minus Rupees Five Hundred Only'
 */
export const numberToIndianWords = (value: unknown, options: NumToWordsOptions = {}): string => {
  const { currency = 'Rupees', subCurrency = 'Paise', only = true, decimals = 2 } = options;

  const numeric =
    typeof value === 'number'
      ? value
      : Number(
          typeof value === 'object' && value !== null
            ? (value as { toString(): string }).toString()
            : (value ?? ''),
        );
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const negative = numeric < 0;
  const magnitude = Math.abs(numeric);

  // Round to the voiced precision FIRST. Voicing 1234.567 as "...Fifty Six"
  // while the printed figure rounds to 1234.57 is the kind of one-paise
  // mismatch an auditor will flag.
  const scale = 10 ** decimals;
  const rounded = Math.round(magnitude * scale) / scale;
  const whole = Math.floor(rounded);
  const fraction = Math.round((rounded - whole) * scale);

  const parts: string[] = [];

  if (negative) {
    parts.push('Minus');
  }
  if (currency) {
    parts.push(currency);
  }
  parts.push(integerToIndianWords(whole));

  if (fraction > 0) {
    parts.push('and');
    if (subCurrency) {
      parts.push(subCurrency);
    }
    parts.push(integerToIndianWords(fraction));
  }

  if (only) {
    parts.push('Only');
  }

  return parts.join(' ');
};
