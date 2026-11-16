import { Prisma } from '@prisma/client';
import { lineWeightKg, unitKgOf, unitKgText } from './delivery-weight';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('delivery weights: one rule for unitKg and weightKg (round 2, S1)', () => {
  it('unitKg is the raw kg per unit rounded half-up to 3 places, always printed with 3', () => {
    expect(unitKgText(D(20))).toBe('20.000');
    expect(unitKgText(D(0))).toBe('0.000');
    expect(unitKgText(null)).toBe('0.000');
    expect(unitKgText(undefined)).toBe('0.000');
    expect(unitKgText(D('10').dividedBy(3))).toBe('3.333');
    expect(unitKgText(D('0.0125'))).toBe('0.013');
    expect(unitKgOf(D('2.5004')).toString()).toBe('2.5');
  });

  it('weightKg = qty × the ROUNDED unitKg, 3 places, so the client can recompute it as qty is typed', () => {
    // 10 kg billed over 3 units: 3.333 per unit; 3 units weigh 9.999, not 10.
    const raw = D('10').dividedBy(3);
    expect(lineWeightKg(D(3), raw).toString()).toBe('9.999');
    expect(lineWeightKg(D(3), raw).equals(D(3).times(D(unitKgText(raw))))).toBe(true);
    expect(lineWeightKg(D(6), D(20)).toString()).toBe('120');
    expect(lineWeightKg(D('2.5'), D('0.0125')).toString()).toBe('0.033'); // 2.5 × 0.013 = 0.0325 → 0.033
    expect(lineWeightKg(D(0), D(20)).toString()).toBe('0');
    expect(lineWeightKg(D(4), null).toString()).toBe('0');
  });
});
