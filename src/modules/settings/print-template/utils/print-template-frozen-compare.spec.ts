import { Prisma } from '@prisma/client';
import { changedVersionKeys, datasetsDifference, jsonDeepEqual, sentValueDiffers } from './print-template-frozen-compare';

describe('frozen revision compare (user 2026-10-29: the server compares)', () => {
  it('numbers as decimals', () => {
    expect(sentValueDiffers('number', 10, new Prisma.Decimal('10.00'))).toBe(false);
    expect(sentValueDiffers('number', '10.5', 10.5)).toBe(false);
    expect(sentValueDiffers('number', 12, new Prisma.Decimal('10'))).toBe(true);
    expect(sentValueDiffers('number', null, null)).toBe(false);
    expect(sentValueDiffers('number', null, new Prisma.Decimal(0))).toBe(true);
  });
  it('undefined = not sent; null, "" and blank are one "no value"', () => {
    expect(sentValueDiffers('text', undefined, 'x')).toBe(false);
    expect(sentValueDiffers('text', '', null)).toBe(false);
    expect(sentValueDiffers('text', null, '  ')).toBe(false);
    expect(sentValueDiffers('text', 'Arial', null)).toBe(true);
    expect(sentValueDiffers('text', 'A4', 'A4')).toBe(false);
  });
  it('JSON deep-equal, key order ignored', () => {
    expect(jsonDeepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(jsonDeepEqual([1, 2], [2, 1])).toBe(false);
    expect(sentValueDiffers('json', [{ n: 'x', t: 'int' }], [{ t: 'int', n: 'x' }])).toBe(false);
    expect(sentValueDiffers('json', [], null)).toBe(true);
    expect(sentValueDiffers('body', '{"b":1,"a":[]}', '{ "a": [], "b": 1 }')).toBe(false);
    expect(sentValueDiffers('body', '{"b":2}', '{"b":1}')).toBe(true);
    expect(sentValueDiffers('body', '<html>a</html>', '<html>a</html> ')).toBe(true);   // not JSON: exact
  });
  it('changedVersionKeys keeps only the sent keys that differ', () => {
    const stored = { ptvEngine: 'JSON_BANDS', ptvMarginTopMm: new Prisma.Decimal('5'), ptvNote: null, ptvLang: 'en-IN' };
    expect(changedVersionKeys({ ptvEngine: 'JSON_BANDS', ptvMarginTopMm: 5, ptvNote: '', ptvLang: 'ta-IN' }, stored,
                              ['ptvEngine', 'ptvMarginTopMm', 'ptvNote', 'ptvLang'])).toEqual(['ptvLang']);
  });
  it('datasets: same set + same fields = no difference; any change named', () => {
    const stored = [{ ptdId: 'd1', ptdName: 'items', ptdRowLimit: 5000, ptdSql: null }, { ptdId: 'd2', ptdName: 'tax', ptdRowLimit: 100, ptdSql: null }];
    expect(datasetsDifference([{ ptdId: 'd2', ptdName: 'tax' }, { ptdId: 'd1', ptdRowLimit: 5000, ptdSql: '' }], stored)).toBeNull();
    expect(datasetsDifference([{ ptdId: 'd1' }], stored)).toContain('2 stored');
    expect(datasetsDifference([{ ptdId: 'd1' }, { ptdName: 'tax' }], stored)).toContain('datasets[1]');
    expect(datasetsDifference([{ ptdId: 'd1' }, { ptdId: 'd2', ptdName: 'taxes' }], stored)).toBe('datasets[1].ptdName');
    expect(datasetsDifference([], [])).toBeNull();
  });
});
