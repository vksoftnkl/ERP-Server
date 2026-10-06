import { numericOverflowOf } from './module-shared.utils';

describe('numericOverflowOf', () => {
  it('reads the detail out of an ORM write (PrismaClientUnknownRequestError)', () => {
    // Verbatim shape of the 2026-10-06 POST /bills/create failure.
    const error = {
      message:
        'Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "22003", message: "numeric field overflow", severity: "ERROR", detail: Some("A field with precision 14, scale 4 must round to an absolute value less than 10^10."), column: None, hint: None }), transient: false })',
    };
    expect(numericOverflowOf(error)).toBe(
      'A field with precision 14, scale 4 must round to an absolute value less than 10^10.',
    );
  });

  it('answers for a raw query (P2010) that carries the SQLSTATE in meta', () => {
    expect(
      numericOverflowOf({ code: 'P2010', message: 'Raw query failed', meta: { code: '22003' } }),
    ).toBe('numeric field overflow');
  });

  it('is null for any other failure', () => {
    expect(numericOverflowOf(new Error('violates check constraint "ck_x" 23514'))).toBeNull();
    expect(numericOverflowOf({ code: 'P2002', meta: { target: ['x'] } })).toBeNull();
    expect(numericOverflowOf(null)).toBeNull();
  });
});
