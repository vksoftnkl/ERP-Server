import { Prisma } from '@prisma/client';
import { pickSlab, valuePerPiece } from './purchase-value-slab';

// R25: the slab test uses the taxable value PER PIECE after discount; ≤ threshold keeps the base rate.
describe('value-based GST slab', () => {
  const s = (v: Prisma.Decimal) => v.toFixed(2);
  it('a shirt at 2,600 less 5 % = 2,470 per piece → stays 5 %', () => {
    const v = valuePerPiece({ rate: 2600, discPct: 5 }, 1);
    expect(s(v)).toBe('2470.00');
    expect(pickSlab('T5', v, 2500, 'T18')).toBe('T5');
  });
  it('a shirt at 2,600 with no discount → 18 %', () => expect(pickSlab('T5', valuePerPiece({ rate: 2600 }, 1), 2500, 'T18')).toBe('T18'));
  it('exactly 2,500 → 5 % (above, not at)', () => expect(pickSlab('T5', valuePerPiece({ rate: 2500 }, 1), 2500, 'T18')).toBe('T5'));
  it('a box of 10 at 26,000 = 2,600 a piece → 18 %', () => {
    const v = valuePerPiece({ rate: 26000 }, 10);
    expect(s(v)).toBe('2600.00');
    expect(pickSlab('T5', v, 2500, 'T18')).toBe('T18');
  });
  it('per-qty discount and scheme % count', () => expect(s(valuePerPiece({ rate: 3000, discPerQty: 200, schPct: 10 }, 1))).toBe('2520.00'));
  it('no threshold on the rate → unchanged', () => expect(pickSlab('T5', valuePerPiece({ rate: 9000 }, 1), null, null)).toBe('T5'));
});
