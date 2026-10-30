import { nextShortageCloseRef } from './purchase-shortage';

describe('shortage close reference (user 2026-10-29: unique per source document)', () => {
  const P = 'PUR/2026-2027/D14/00534';
  it('first close of a bill is X1', () => expect(nextShortageCloseRef(P, [])).toBe(`${P}/X1`));
  it('a second shortage of the same bill gets X2, not another X1', () => expect(nextShortageCloseRef(P, [`${P}/X1`])).toBe(`${P}/X2`));
  it('one past the highest, gaps and order do not matter; numbers are never reused', () =>
    expect(nextShortageCloseRef(P, [`${P}/X3`, `${P}/X1`])).toBe(`${P}/X4`));
  it('settlement refs (/X1/S1) and other prefixes are ignored', () =>
    expect(nextShortageCloseRef(P, [`${P}/X1/S1`, `${P}/X12/S2`, 'PUR/2026-2027/D14/005340/X9', `${P}/Xabc`])).toBe(`${P}/X1`));
  it('a prefix that is itself a longer refno does not match a shorter one', () =>
    expect(nextShortageCloseRef(`${P}0`, [`${P}/X5`])).toBe(`${P}0/X1`));
});
