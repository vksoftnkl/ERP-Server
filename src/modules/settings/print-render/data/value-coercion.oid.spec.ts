import type { QueryResult } from 'pg';
import { coerceProviderRow, coerceProviderValue, coerceResultRows } from './value-coercion';

const resultOf = (oid: number, values: unknown[]) =>
  ({
    rows: values.map((value) => ({ v: value })),
    fields: [{ name: 'v', dataTypeID: oid }],
  }) as unknown as QueryResult;

const column = (oid: number, values: unknown[]) =>
  coerceResultRows(resultOf(oid, values)).map((row) => row.v);

const INT2 = 21;
const INT4 = 23;
const INT8 = 20;
const FLOAT4 = 700;
const FLOAT8 = 701;
const TIMESTAMP = 1114;
const VARCHAR = 1043;
const UNKNOWN = 999999;

describe('coerceResultRows — the less common OIDs', () => {
  it.each([
    [INT2, '7', 7],
    [INT4, 42, 42],
    [FLOAT4, '1.5', 1.5],
    [FLOAT8, '-0.25', -0.25],
  ])('turns oid %p value %p into the number %p', (oid, value, expected) => {
    expect(column(oid, [value])).toEqual([expected]);
  });

  it('nulls an infinite float rather than printing Infinity down a column', () => {
    expect(column(FLOAT8, ['Infinity'])).toEqual([null]);
  });

  it('reads a bigint column sent as text by its size', () => {
    expect(column(INT8, ['42', '9007199254740993'])).toEqual([42, '9007199254740993']);
  });

  it('keeps a timestamp that arrived as text as that text', () => {
    expect(column(TIMESTAMP, ['2026-10-19 10:00:00'])).toEqual(['2026-10-19 10:00:00']);
  });

  it('leaves a varchar alone, numeric-looking or not', () => {
    expect(column(VARCHAR, ['0012', 'INV/1'])).toEqual(['0012', 'INV/1']);
  });

  it('handles a type it does not know by the value it got', () => {
    const at = new Date('2026-10-19T04:30:00.000Z');

    expect(column(UNKNOWN, [at, ['a', 'b'], { k: 1 }, 5n, 3, true])).toEqual([
      '2026-10-19T04:30:00.000Z',
      ['a', 'b'],
      { k: 1 },
      5,
      '3',
      'true',
    ]);
  });
});

describe('coerceProviderValue / coerceProviderRow', () => {
  it('reads a bigint by its size', () => {
    expect(coerceProviderValue(12n)).toBe(12);
    expect(coerceProviderValue(9007199254740993n)).toBe('9007199254740993');
  });

  it('nulls a Decimal-like value that is not finite', () => {
    expect(coerceProviderValue({ toNumber: () => Number.NaN })).toBeNull();
  });

  it('passes numbers, booleans and plain objects through, and undefined as null', () => {
    expect(coerceProviderValue(3.5)).toBe(3.5);
    expect(coerceProviderValue(false)).toBe(false);
    expect(coerceProviderValue({ a: 1 })).toEqual({ a: 1 });
    expect(coerceProviderValue(undefined)).toBeNull();
  });

  it('coerces every value of a row and keeps its keys', () => {
    expect(
      coerceProviderRow({
        amt: { toNumber: () => 12.5 },
        on: new Date('2026-10-19T04:30:00.000Z'),
        note: null,
        name: 'x',
      }),
    ).toEqual({ amt: 12.5, on: '2026-10-19T04:30:00.000Z', note: null, name: 'x' });
  });
});
