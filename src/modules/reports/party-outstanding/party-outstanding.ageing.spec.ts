import { Prisma } from '@prisma/client';
import {
  aboveDaysEdge,
  addDays,
  ageOf,
  bucketCount,
  bucketIndex,
  bucketIndexSql,
  bucketLabels,
  collectionDayNames,
  collectionDayNumber,
  daysBetween,
  dueEff,
  isRealIsoDate,
  istToday,
  overdueDays,
  parseBuckets,
} from './party-outstanding.ageing';

describe('party-outstanding ageing (plan §4.4)', () => {
  describe('parseBuckets', () => {
    it('defaults to 30,60,90,180 when absent or blank', () => {
      expect(parseBuckets(undefined)).toEqual([30, 60, 90, 180]);
      expect(parseBuckets('  ')).toEqual([30, 60, 90, 180]);
    });

    it('accepts commas and/or spaces', () => {
      expect(parseBuckets('30,60,90,180')).toEqual([30, 60, 90, 180]);
      expect(parseBuckets('15 45  90')).toEqual([15, 45, 90]);
      expect(parseBuckets('7, 14')).toEqual([7, 14]);
      expect(parseBuckets('365')).toEqual([365]);
    });

    it.each([
      ['not ascending', '30,20'],
      ['equal edges', '30,30'],
      ['zero', '0,30'],
      ['above 3650', '30,3651'],
      ['seven edges', '1,2,3,4,5,6,7'],
      ['a decimal', '30.5,60'],
      ['a negative', '-30,60'],
      ['words', '30,sixty'],
    ])('BAD_BUCKETS: %s', (_, raw) => {
      expect(parseBuckets(raw)).toBeNull();
    });

    it('allows six edges and 3650', () => {
      expect(parseBuckets('1,2,3,4,5,3650')).toEqual([1, 2, 3, 4, 5, 3650]);
    });
  });

  describe('labels and bucket index', () => {
    const edges = [30, 60, 90, 180];

    it('labels by bill date', () => {
      expect(bucketLabels(edges, 'BILL_DATE')).toEqual([
        '0–30',
        '31–60',
        '61–90',
        '91–180',
        '> 180',
      ]);
      expect(bucketCount(edges, 'BILL_DATE')).toBe(5);
    });

    it('labels by due date start with Not due', () => {
      expect(bucketLabels(edges, 'DUE_DATE')).toEqual([
        'Not due',
        '0–30',
        '31–60',
        '61–90',
        '91–180',
        '> 180',
      ]);
      expect(bucketCount(edges, 'DUE_DATE')).toBe(6);
    });

    it('puts an age on an edge into the lower bucket (0–30 holds 30)', () => {
      expect(bucketIndex(0, edges, 'BILL_DATE')).toBe(0);
      expect(bucketIndex(30, edges, 'BILL_DATE')).toBe(0);
      expect(bucketIndex(31, edges, 'BILL_DATE')).toBe(1);
      expect(bucketIndex(180, edges, 'BILL_DATE')).toBe(3);
      expect(bucketIndex(181, edges, 'BILL_DATE')).toBe(4);
    });

    it('sends a negative due-date age to Not due and shifts the rest by one', () => {
      expect(bucketIndex(-1, edges, 'DUE_DATE')).toBe(0);
      expect(bucketIndex(0, edges, 'DUE_DATE')).toBe(1);
      expect(bucketIndex(30, edges, 'DUE_DATE')).toBe(1);
      expect(bucketIndex(500, edges, 'DUE_DATE')).toBe(5);
    });

    it('every index has a label', () => {
      for (const ageBy of ['BILL_DATE', 'DUE_DATE'] as const) {
        for (const age of [-400, -1, 0, 1, 30, 31, 60, 61, 90, 91, 180, 181, 4000]) {
          const i = bucketIndex(ageBy === 'BILL_DATE' ? Math.abs(age) : age, edges, ageBy);
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(bucketLabels(edges, ageBy).length);
        }
      }
    });

    it('builds the SQL CASE from the same edges, values as parameters', () => {
      const sql = bucketIndexSql(Prisma.sql`age`, [30, 60], 'DUE_DATE');
      expect(sql.text.replace(/\s+/g, ' ')).toBe(
        '(CASE WHEN age < 0 THEN 0 WHEN age <= $1::int THEN $2::int WHEN age <= $3::int THEN $4::int ELSE $5::int END)',
      );
      expect(sql.values).toEqual([30, 1, 60, 2, 3]);
      const bill = bucketIndexSql(Prisma.sql`age`, [30], 'BILL_DATE');
      expect(bill.values).toEqual([30, 0, 1]);
    });

    it('takes the third edge for the "Above N days" tile, else the last', () => {
      expect(aboveDaysEdge([30, 60, 90, 180])).toBe(90);
      expect(aboveDaysEdge([15, 45])).toBe(45);
      expect(aboveDaysEdge([365])).toBe(365);
    });
  });

  describe('due date, overdue and age (O2)', () => {
    it('uses the bill due date when there is one', () => {
      expect(dueEff('2026-09-01', '2026-09-20', 45)).toBe('2026-09-20');
    });

    it('falls back to bill date + credit days when the due date is NULL', () => {
      expect(dueEff('2026-09-01', null, 30)).toBe('2026-10-01');
    });

    it('a NULL due date with 0 credit days is due on the bill date (cash-on-credit ages)', () => {
      expect(dueEff('2026-09-25', null, 0)).toBe('2026-09-25');
      expect(dueEff('2026-09-25', null, null)).toBe('2026-09-25');
      expect(overdueDays('2026-10-09', '2026-09-25', 0)).toBe(14);
    });

    it('is overdue only past due + grace', () => {
      expect(overdueDays('2026-10-01', '2026-10-01', 0)).toBeNull();
      expect(overdueDays('2026-10-02', '2026-10-01', 0)).toBe(1);
      expect(overdueDays('2026-10-05', '2026-10-01', 4)).toBeNull();
      expect(overdueDays('2026-10-06', '2026-10-01', 4)).toBe(1);
    });

    it('ages by bill date or due date', () => {
      expect(ageOf('2026-10-09', '2026-09-01', '2026-10-01', 'BILL_DATE')).toBe(38);
      expect(ageOf('2026-10-09', '2026-09-01', '2026-10-01', 'DUE_DATE')).toBe(8);
      expect(ageOf('2026-09-20', '2026-09-01', '2026-10-01', 'DUE_DATE')).toBe(-11);
    });
  });

  describe('dates', () => {
    it('adds and subtracts across a month and a leap day', () => {
      expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
      expect(daysBetween('2026-03-25', '2026-04-05')).toBe(11);
    });

    it('rejects a date that is not on the calendar', () => {
      expect(isRealIsoDate('2026-02-29')).toBe(false);
      expect(isRealIsoDate('2028-02-29')).toBe(true);
      expect(isRealIsoDate('2026-13-01')).toBe(false);
      expect(isRealIsoDate('26-10-09')).toBe(false);
    });

    it('reads today in IST, not UTC', () => {
      expect(istToday(new Date('2026-10-08T18:29:00Z'))).toBe('2026-10-08');
      expect(istToday(new Date('2026-10-08T18:30:00Z'))).toBe('2026-10-09');
    });
  });

  describe('collection days (arm_collection_days: ISO, Monday = 1)', () => {
    it('maps names to numbers and back', () => {
      expect(collectionDayNumber('MON')).toBe(1);
      expect(collectionDayNumber('SUN')).toBe(7);
      expect(collectionDayNames([4, 1, 7, 1])).toEqual(['MON', 'THU', 'SUN']);
      expect(collectionDayNames([0, 8])).toEqual([]);
      expect(collectionDayNames(null)).toEqual([]);
    });
  });
});
