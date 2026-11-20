import { Prisma } from '@prisma/client';
import { suggestPpdDiscount } from '../../modules/accountsModule/receipt/ppd-slab';
import { ppdScheduleOf } from './mobile-receipt-ppd';

const DOC = new Date('2026-11-01T00:00:00.000Z');
const on = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const PENDING = new Prisma.Decimal('1180.00');

describe('ppdScheduleOf', () => {
  it('no slabs, or nothing pending: no steps', () => {
    expect(
      ppdScheduleOf({ docDate: DOC, onDate: on('2026-11-01'), pendingAmount: PENDING, slabs: [] }),
    ).toEqual([]);
    expect(
      ppdScheduleOf({
        docDate: DOC,
        onDate: on('2026-11-01'),
        pendingAmount: new Prisma.Decimal(0),
        slabs: [{ days: 7, perc: 2 }],
      }),
    ).toEqual([]);
  });

  it('one step per slab still ahead, its figure what ppd-slab suggests that day', () => {
    const slabs = [
      { days: 15, perc: 1 },
      { days: 7, perc: 2 },
    ];
    expect(
      ppdScheduleOf({ docDate: DOC, onDate: on('2026-11-03'), pendingAmount: PENDING, slabs }),
    ).toEqual([
      { tillDate: '2026-11-08', perc: '2.000', amount: '23.60' },
      { tillDate: '2026-11-16', perc: '1.000', amount: '11.80' },
    ]);
    // past the 7-day slab only the 1% step is left
    expect(
      ppdScheduleOf({ docDate: DOC, onDate: on('2026-11-09'), pendingAmount: PENDING, slabs }),
    ).toEqual([{ tillDate: '2026-11-16', perc: '1.000', amount: '11.80' }]);
    expect(
      ppdScheduleOf({ docDate: DOC, onDate: on('2026-11-17'), pendingAmount: PENDING, slabs }),
    ).toEqual([]);
  });

  it('the first step on or after a date is exactly what ppd-slab suggests on that date', () => {
    const slabs = [
      { days: 3, perc: 0.5 },
      { days: 10, perc: 3 },
      { days: 30, perc: 1.5 },
    ];
    const steps = ppdScheduleOf({
      docDate: DOC,
      onDate: on('2026-11-01'),
      pendingAmount: PENDING,
      slabs,
    });
    for (let day = 0; day <= 31; day += 1) {
      const date = new Date(DOC.getTime() + day * 86_400_000);
      const iso = date.toISOString().slice(0, 10);
      const step = steps.find((s) => s.tillDate >= iso);
      const expected = suggestPpdDiscount({
        docDate: DOC,
        onDate: date,
        pendingAmount: PENDING,
        slabs,
      });
      expect(step ? step.amount : '0.00').toBe(expected.toFixed(2));
    }
    // 3% beats the 0.5% of the tighter window, so that step folds into the 10-day one
    expect(steps.map((s) => [s.tillDate, s.perc])).toEqual([
      ['2026-11-11', '3.000'],
      ['2026-12-01', '1.500'],
    ]);
  });
});
