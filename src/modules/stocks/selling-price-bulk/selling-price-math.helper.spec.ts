import { exclusiveOfTax, recomputeLevel } from './selling-price-math.helper';

describe('selling-price-math.helper', () => {
  // ── exclusiveOfTax ────────────────────────────────────────────────────────
  describe('exclusiveOfTax', () => {
    it('takes the tax out of a tax-inclusive price, rounded to the column scale', () => {
      expect(exclusiveOfTax(118, 18)).toBe(100);
      expect(exclusiveOfTax(95, 18)).toBe(80.508475);
      expect(exclusiveOfTax(100, 0)).toBe(100);
    });

    it.each([
      ['a −100% tax, which would divide by zero', -100],
      ['a tax below −100%', -150],
    ])('leaves the price as it is for %s', (_label, taxPerc) => {
      expect(exclusiveOfTax(100, taxPerc)).toBe(100);
    });

    it('answers 0 rather than NaN or Infinity for a figure that is not finite', () => {
      expect(exclusiveOfTax(Number.POSITIVE_INFINITY, 18)).toBe(0);
      expect(exclusiveOfTax(Number.NaN, 18)).toBe(0);
    });
  });

  // ── recomputeLevel ────────────────────────────────────────────────────────
  describe('recomputeLevel', () => {
    it('derives the other three numbers from price — markup on the inclusive pair, margin on the exclusive', () => {
      expect(recomputeLevel(2, 118, 18, 95)).toEqual({
        level: 2,
        price: 118,
        priceWot: 100,
        markupPerc: 24.210526,
        marginPerc: 19.491525,
      });
    });

    it('keeps float noise out of the stored price', () => {
      expect(recomputeLevel(1, 0.1 + 0.2, 0, 0).price).toBe(0.3);
    });

    it('answers 0 for both ratios when the cost is unknown, never Infinity or a flattering 100%', () => {
      expect(recomputeLevel(1, 118, 18, 0)).toMatchObject({ markupPerc: 0, marginPerc: 0 });
    });

    it('reports a price below cost as a negative markup and margin', () => {
      const value = recomputeLevel(1, 90, 0, 100);

      expect(value.markupPerc).toBe(-10);
      expect(value.marginPerc).toBe(-11.111111);
    });

    it('answers 0 margin for a zero price, which has nothing to divide by', () => {
      expect(recomputeLevel(4, 0, 18, 95)).toMatchObject({
        price: 0,
        priceWot: 0,
        markupPerc: -100,
        marginPerc: 0,
      });
    });
  });
});
