import { Prisma } from '@prisma/client';
import {
  accYearOf,
  addDays,
  bucketTaxes,
  daysBetween,
  isoDate,
  isoDateTime,
  money,
  num,
  numericTail,
  ON_ACCOUNT_TENDER_TYPES,
  round2,
  round4,
  supplyNatureOf,
  TENDER_TYPE,
} from './sales-doc.utils';

describe('sales-doc.utils', () => {
  describe('round2 / round4 / money', () => {
    it('rounds the half-paisa up where float64 would round it down', () => {
      // 1.005 is stored as 1.00499999…; the epsilon nudge is what makes it 1.01.
      expect(round2(1.005)).toBe(1.01);
      expect(round2(2.675)).toBe(2.68);
      expect(round4(1.00005)).toBe(1.0001);
    });

    it('rounds a negative figure away from zero at the half', () => {
      expect(round2(-1.005)).toBe(-1.01);
      expect(round2(0)).toBe(0);
    });

    it('prints money with exactly two decimals', () => {
      expect(money(12)).toBe('12.00');
      expect(money(0.1 + 0.2)).toBe('0.30');
    });
  });

  describe('num', () => {
    it.each([
      [null, 0],
      [undefined, 0],
      [Number.NaN, 0],
      [Number.POSITIVE_INFINITY, 0],
      ['12.5', 12.5],
      ['abc', 0],
      [7n, 7],
      [new Prisma.Decimal('118.25'), 118.25],
    ])('reads %p as %p, never NaN', (value, expected) => {
      expect(num(value as never)).toBe(expected);
    });
  });

  describe('dates', () => {
    it('cuts a date to its ISO day, whether it came as a Date or as text', () => {
      expect(isoDate(new Date('2026-10-19T18:45:00.000Z'))).toBe('2026-10-19');
      expect(isoDate('2026-10-19T00:00:00')).toBe('2026-10-19');
      expect(isoDate('2026-10')).toBe('2026-10');
      expect(isoDate(null)).toBeNull();
      expect(isoDate('')).toBeNull();
    });

    it('prints a timestamp in full, or null', () => {
      expect(isoDateTime(new Date('2026-10-19T04:30:00.000Z'))).toBe('2026-10-19T04:30:00.000Z');
      expect(isoDateTime(null)).toBeNull();
    });

    it('counts and steps whole calendar days across a month end', () => {
      expect(daysBetween('2026-01-30', '2026-03-01')).toBe(30);
      expect(daysBetween('2026-03-01', '2026-01-30')).toBe(-30);
      expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('files a date into its April–March year', () => {
      expect(accYearOf('2026-04-01')).toBe('2026-2027');
      expect(accYearOf('2026-03-31')).toBe('2025-2026');
      expect(accYearOf('2027-01-15')).toBe('2026-2027');
    });
  });

  describe('supplyNatureOf', () => {
    it('is INTRA in the company state and INTER outside it', () => {
      expect(supplyNatureOf('33', '33')).toBe('INTRA');
      expect(supplyNatureOf('33', '29')).toBe('INTER');
      expect(supplyNatureOf(' 33 ', '33')).toBe('INTRA');
    });

    it('reads a missing place of supply as intra-state', () => {
      expect(supplyNatureOf('33', null)).toBe('INTRA');
      expect(supplyNatureOf('33', '  ')).toBe('INTRA');
      expect(supplyNatureOf(undefined, '29')).toBe('INTRA');
    });
  });

  describe('numericTail', () => {
    it('takes the digits at the end of the refno', () => {
      expect(numericTail('bil00042', 0n)).toBe(42n);
      expect(numericTail('DC/2026/107  ', 0n)).toBe(107n);
    });

    it('falls back when the refno has no numeric tail', () => {
      expect(numericTail('DRAFT', 9n)).toBe(9n);
      expect(numericTail(null, 5n)).toBe(5n);
    });
  });

  describe('bucketTaxes', () => {
    it('sums one bucket per tax id, in first-seen order', () => {
      const out = bucketTaxes([
        { taxId: 'gst18', cgst: 4.5, sgst: 4.5, igst: 0, cess: 0 },
        { taxId: 'gst5', cgst: 1.25, sgst: 1.25, igst: 0, cess: 0 },
        { taxId: 'gst18', cgst: 4.5, sgst: 4.5, igst: 0, cess: 1, acess: 0.25 },
      ]);

      expect(out).toEqual([
        { taxId: 'gst18', cgst: 9, sgst: 9, igst: 0, cess: 1, acess: 0.25 },
        { taxId: 'gst5', cgst: 1.25, sgst: 1.25, igst: 0, cess: 0, acess: 0 },
      ]);
    });

    it('rounds each summed head to the paisa', () => {
      expect(bucketTaxes([{ taxId: 'gst18', cgst: 1.005, sgst: 0.3333, igst: 0, cess: 0 }])).toEqual([
        { taxId: 'gst18', cgst: 1.01, sgst: 0.33, igst: 0, cess: 0, acess: 0 },
      ]);
    });

    it('keeps rows with no tax id together in one bucket', () => {
      expect(
        bucketTaxes([
          { taxId: null, cgst: 1, sgst: 1, igst: 0, cess: 0 },
          { taxId: null, cgst: 2, sgst: 2, igst: 0, cess: 0 },
        ]),
      ).toEqual([{ taxId: null, cgst: 3, sgst: 3, igst: 0, cess: 0, acess: 0 }]);
    });
  });

  it('treats CREDIT, TEMP_CREDIT and RRN as the tenders that move no money', () => {
    expect([...ON_ACCOUNT_TENDER_TYPES].sort()).toEqual(
      [TENDER_TYPE.CREDIT, TENDER_TYPE.TEMP_CREDIT, TENDER_TYPE.RRN].sort(),
    );
    expect(ON_ACCOUNT_TENDER_TYPES).not.toContain(TENDER_TYPE.CASH);
    expect(ON_ACCOUNT_TENDER_TYPES).not.toContain(TENDER_TYPE.LOYALTY);
  });
});
