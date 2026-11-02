import { Prisma } from '@prisma/client';
import { savedMinPrice, shownMinPrice } from './purchase-invoice-msp';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const s = (v: Prisma.Decimal | null) => (v === null ? null : v.toFixed(2));

describe('purchase invoice MSP (P9): shown vs saved', () => {
  it('an untouched MSP: the line SHOWS the item\'s current minimum but SAVES null (Post leaves the item alone)', () => {
    expect(s(shownMinPrice(undefined, D(125)))).toBe('125.00');
    expect(savedMinPrice(undefined)).toBeNull();
    expect(s(shownMinPrice(null, D(125)))).toBe('125.00');
    expect(savedMinPrice(null)).toBeNull();
  });

  it('no current minimum and nothing typed: null both ways', () => {
    expect(shownMinPrice(undefined, null)).toBeNull();
    expect(shownMinPrice(undefined, undefined)).toBeNull();
  });

  it('a typed MSP is shown and saved (2 places), over the item\'s own — the same on re-save of a draft', () => {
    expect(s(shownMinPrice(130, D(125)))).toBe('130.00');
    expect(s(savedMinPrice(130))).toBe('130.00');
    expect(s(savedMinPrice(99.995))).toBe('100.00');
    // the screen re-sends the draft's stored piiMinPrice: it stays what was typed, whatever the item has now
    expect(s(savedMinPrice(Number(savedMinPrice(130))))).toBe('130.00');
  });

  it('a typed 0 is kept as 0 ("no MSP": Post clears the item\'s minimum)', () => {
    expect(s(savedMinPrice(0))).toBe('0.00');
    expect(s(shownMinPrice(0, D(125)))).toBe('0.00');
  });
});
