import { Prisma } from '@prisma/client';
import { parsePpdSlabs, suggestPpdDiscount } from './ppd-slab';

/**
 * R16 — the plan's §9 case, and the parsing that stands between a bad setting
 * and an operator who cannot take money.
 */

const d = (value: number): Prisma.Decimal => new Prisma.Decimal(value);
const DATE = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const SLABS = parsePpdSlabs('[{"days":7,"perc":2},{"days":15,"perc":1}]');

describe('parsePpdSlabs', () => {
  it('reads the documented shape', () => {
    expect(SLABS).toEqual([
      { days: 7, perc: 2 },
      { days: 15, perc: 1 },
    ]);
  });

  it('returns nothing for an unset or empty setting', () => {
    expect(parsePpdSlabs(null)).toEqual([]);
    expect(parsePpdSlabs('')).toEqual([]);
    expect(parsePpdSlabs('[]')).toEqual([]);
  });

  it('drops a malformed slab rather than throwing', () => {
    // This is read on every keystroke of a screen the operator cannot use to
    // fix the setting. A 500 here would stop them taking money; dropping the
    // slab only stops them being offered a discount.
    expect(parsePpdSlabs('not json')).toEqual([]);
    expect(parsePpdSlabs('{"days":7}')).toEqual([]);
    expect(parsePpdSlabs('[{"days":"7","perc":2}]')).toEqual([]);
    expect(parsePpdSlabs('[{"days":-1,"perc":2},{"days":7,"perc":2}]')).toEqual([
      { days: 7, perc: 2 },
    ]);
  });

  it('refuses a discount of 100% or more — that is a write-off, not a discount', () => {
    expect(parsePpdSlabs('[{"days":7,"perc":100}]')).toEqual([]);
    expect(parsePpdSlabs('[{"days":7,"perc":0}]')).toEqual([]);
  });
});

describe('suggestPpdDiscount', () => {
  const pendingAmount = d(10000);

  it('§9 — a bill aged 6 days suggests 2%', () => {
    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-09-08'),
        onDate: DATE('2026-09-14'),
        pendingAmount,
        slabs: SLABS,
      }).toFixed(2),
    ).toBe('200.00');
  });

  it('§9 — aged 10 days suggests 1%', () => {
    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-09-04'),
        onDate: DATE('2026-09-14'),
        pendingAmount,
        slabs: SLABS,
      }).toFixed(2),
    ).toBe('100.00');
  });

  it('§9 — aged 20 days suggests nothing', () => {
    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-08-25'),
        onDate: DATE('2026-09-14'),
        pendingAmount,
        slabs: SLABS,
      }).toFixed(2),
    ).toBe('0.00');
  });

  it('is based on what is LEFT, not the face value', () => {
    // A 10,000 bill already half paid has 5,000 left; 2% of what is being
    // settled today is 100. Basing it on the face value would offer the full
    // discount again on every instalment.
    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-09-12'),
        onDate: DATE('2026-09-14'),
        pendingAmount: d(5000),
        slabs: SLABS,
      }).toFixed(2),
    ).toBe('100.00');
  });

  it('takes the BEST slab, not the first, on an unsorted configuration', () => {
    const unsorted = parsePpdSlabs('[{"days":15,"perc":1},{"days":7,"perc":2}]');
    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-09-13'),
        onDate: DATE('2026-09-14'),
        pendingAmount,
        slabs: unsorted,
      }).toFixed(2),
    ).toBe('200.00');
  });

  it('gives the tightest slab to a bill dated in the future', () => {
    // A receipt keyed before the invoice date is a data-entry question, not a
    // reason to withhold a discount the customer is plainly entitled to.
    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-09-20'),
        onDate: DATE('2026-09-14'),
        pendingAmount,
        slabs: SLABS,
      }).toFixed(2),
    ).toBe('200.00');
  });

  it('suggests nothing when nothing is configured or nothing is pending', () => {
    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-09-13'),
        onDate: DATE('2026-09-14'),
        pendingAmount,
        slabs: [],
      }).toFixed(2),
    ).toBe('0.00');

    expect(
      suggestPpdDiscount({
        docDate: DATE('2026-09-13'),
        onDate: DATE('2026-09-14'),
        pendingAmount: d(0),
        slabs: SLABS,
      }).toFixed(2),
    ).toBe('0.00');
  });
});
