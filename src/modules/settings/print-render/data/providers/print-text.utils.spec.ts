import { Prisma } from '@prisma/client';
import { countText, dmyText, istText, qtyText, RenderMemo, uuidList } from './print-text.utils';

describe('print-text utils (delivery tracking P5)', () => {
  it('qtyText: no trailing zeros, Indian grouping, sign kept, half-up at 3 places', () => {
    expect(qtyText('1117.000')).toBe('1,117');
    expect(qtyText('9.999')).toBe('9.999');
    expect(qtyText(new Prisma.Decimal('12.50'))).toBe('12.5');
    expect(qtyText('0.000')).toBe('0');
    expect(qtyText(null)).toBe('0');
    expect(qtyText('-2.5')).toBe('-2.5');
    expect(qtyText('1234567.0005')).toBe('12,34,567.001');
    expect(qtyText(80)).toBe('80');
  });

  it('istText: IST 12-hour whatever the process zone; dmyText from a date', () => {
    expect(istText(new Date('2026-11-16T06:22:00Z'))).toBe('16/11/2026 11:52 AM');
    expect(istText('2026-11-15T18:40:00.000Z')).toBe('16/11/2026 12:10 AM');
    expect(istText('2026-11-16T06:30:00Z')).toBe('16/11/2026 12:00 PM');
    expect(istText(null)).toBe('');
    expect(dmyText('2026-11-16')).toBe('16/11/2026');
    expect(dmyText(null)).toBe('');
  });

  it('countText and uuidList', () => {
    expect(countText(1, 'line')).toBe('1 line');
    expect(countText(2, 'line')).toBe('2 lines');
    const a = '01a1e303-8b11-7f00-8c1c-111111111111';
    expect(uuidList(` ${a}, ${a.toUpperCase()} ;\n01a1e303-8b22-7f00-8c1c-222222222222`, 'bill_ids')).toEqual([
      a,
      '01a1e303-8b22-7f00-8c1c-222222222222',
    ]);
    expect(uuidList(undefined, 'bill_ids')).toEqual([]);
    expect(() => uuidList('bil04539', 'bill_ids')).toThrow(/'bil04539' is not an id/);
    expect(() => uuidList(Array(3).fill(0).map((_, i) => `01a1e303-8b11-7f00-8c1c-00000000000${i}`).join(','), 'x', 2)).toThrow(
      /3 ids sent; at most 2/,
    );
  });

  it('RenderMemo: concurrent callers share one run; a failure is not kept', async () => {
    const memo = new RenderMemo<number>(50);
    const work = jest.fn(async () => 7);
    expect(await Promise.all([memo.get('k', work), memo.get('k', work)])).toEqual([7, 7]);
    expect(work).toHaveBeenCalledTimes(1);
    const bad = jest.fn(async () => {
      throw new Error('no');
    });
    await expect(memo.get('b', bad)).rejects.toThrow('no');
    await Promise.resolve();
    await expect(memo.get('b', bad)).rejects.toThrow('no');
    expect(bad).toHaveBeenCalledTimes(2);
  });
});
