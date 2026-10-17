import { QueryResult } from 'pg';
import { coerceProviderRow, coerceResultRows, duplicateColumns } from './value-coercion';

/**
 * The bug this file exists to prevent, found in a live render before it had a
 * test: every money column on a real invoice arrived as a STRING, because that
 * is what node-pg does with `numeric` — correctly, since a JavaScript number
 * cannot hold every value a `numeric(15,2)` can.
 *
 * It was invisible in the obvious case. `{{ bill.bill_amt|fmt('#,##0.00') }}`
 * printed 9,393.00 exactly as intended, because the formatter parses its input.
 * What did not work was arithmetic — `'7960.00' + '1432.80'` is
 * '7960.001432.80' — and comparison, where '900' > '1000' is true. A defect
 * that only shows up in the two cases that matter, on a document somebody
 * signs, is the worst shape a defect can have.
 */

/** A pg result, as node-pg would hand it back. */
function result(
  fields: Array<[name: string, oid: number]>,
  rows: Record<string, unknown>[],
): QueryResult {
  return {
    rows,
    fields: fields.map(([name, dataTypeID]) => ({ name, dataTypeID })),
  } as unknown as QueryResult;
}

const OID = {
  BOOL: 16,
  INT8: 20,
  INT4: 23,
  NUMERIC: 1700,
  TEXT: 25,
  VARCHAR: 1043,
  DATE: 1082,
  TIMESTAMPTZ: 1184,
  JSONB: 3802,
};

describe('coerceResultRows', () => {
  it('turns numeric strings into numbers that can be added', () => {
    const [row] = coerceResultRows(
      result(
        [
          ['taxable_amt', OID.NUMERIC],
          ['tax_amt', OID.NUMERIC],
        ],
        [{ taxable_amt: '7960.00', tax_amt: '1432.80' }],
      ),
    );

    expect(row.taxable_amt).toBe(7960);
    expect((row.taxable_amt as number) + (row.tax_amt as number)).toBeCloseTo(9392.8);
  });

  it('leaves a numeric-LOOKING text column alone, leading zeros intact', () => {
    // The reason this reads the type OID rather than sniffing the value. A bill
    // number, a GSTIN, an HSN code, a pin code and a phone number are all text
    // whose leading zeros or length are part of the value, and printing
    // '0012345' as 12345 falsifies a legal document.
    const [row] = coerceResultRows(
      result(
        [
          ['bill_refno', OID.VARCHAR],
          ['hsn_code', OID.VARCHAR],
        ],
        [{ bill_refno: '0012345', hsn_code: '07136000' }],
      ),
    );

    expect(row.bill_refno).toBe('0012345');
    expect(row.hsn_code).toBe('07136000');
  });

  it('keeps a date as the text PostgreSQL wrote', () => {
    // A calendar date names no instant, so there is nothing for a timezone to
    // do to it — and a Date at local midnight serialises as the day before on
    // an IST server.
    const [row] = coerceResultRows(
      result([['bill_date', OID.DATE]], [{ bill_date: '2026-08-14' }]),
    );
    expect(row.bill_date).toBe('2026-08-14');
  });

  it('renders a timestamptz as an ISO instant', () => {
    const [row] = coerceResultRows(
      result(
        [['bill_datetime', OID.TIMESTAMPTZ]],
        [{ bill_datetime: new Date('2026-08-14T10:45:57.000Z') }],
      ),
    );
    expect(row.bill_datetime).toBe('2026-08-14T10:45:57.000Z');
  });

  it('makes a small bigint a number and leaves an unsafe one as text', () => {
    const [row] = coerceResultRows(
      result(
        [
          ['bill_slno', OID.INT8],
          ['huge', OID.INT8],
        ],
        [{ bill_slno: '15', huge: '9007199254740993' }],
      ),
    );

    expect(row.bill_slno).toBe(15);
    // Past 2^53 the last digits would be lost silently, and a document number
    // that prints one digit wrong is worse than one that prints as text.
    expect(row.huge).toBe('9007199254740993');
  });

  it('turns an unparseable numeric into null rather than printing NaN down a column', () => {
    const [row] = coerceResultRows(result([['amt', OID.NUMERIC]], [{ amt: 'not a number' }]));
    // Null prints blank, which reads as "this cell has no value" — which is
    // what happened. 'NaN' down a money column reads as a broken printer.
    expect(row.amt).toBeNull();
  });

  it('passes booleans and json through untouched', () => {
    const [row] = coerceResultRows(
      result(
        [
          ['is_interstate', OID.BOOL],
          ['meta', OID.JSONB],
        ],
        [{ is_interstate: false, meta: { a: 1 } }],
      ),
    );

    expect(row.is_interstate).toBe(false);
    expect(row.meta).toEqual({ a: 1 });
  });

  it('nulls survive every branch', () => {
    const [row] = coerceResultRows(
      result(
        [
          ['amt', OID.NUMERIC],
          ['name', OID.TEXT],
          ['when', OID.TIMESTAMPTZ],
          ['n', OID.INT4],
        ],
        [{ amt: null, name: null, when: null, n: null }],
      ),
    );

    expect(row).toEqual({ amt: null, name: null, when: null, n: null });
  });
});

describe('duplicateColumns', () => {
  it('names a column the SELECT returns twice', () => {
    // `SELECT a.id, b.id` leaves only the last reachable from an expression,
    // which is node-pg's own behaviour and not something this can repair.
    expect(
      duplicateColumns(
        result(
          [
            ['id', OID.TEXT],
            ['id', OID.TEXT],
            ['name', OID.TEXT],
          ],
          [],
        ),
      ),
    ).toEqual(['id']);
  });
});

describe('coerceProviderValue', () => {
  it("unwraps Prisma's Decimal without importing it", () => {
    const decimalLike = { toNumber: () => 1234.5 };
    expect(coerceProviderRow({ amt: decimalLike }).amt).toBe(1234.5);
  });

  it('renders a Date as an ISO instant', () => {
    expect(coerceProviderRow({ at: new Date('2026-08-14T10:45:57.000Z') }).at).toBe(
      '2026-08-14T10:45:57.000Z',
    );
  });

  it('leaves a plain string alone', () => {
    expect(coerceProviderRow({ refno: '0012345' }).refno).toBe('0012345');
  });
});
