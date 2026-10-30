import { applyPresentFields, isPresentField, numericOverflowOf } from './module-shared.utils';

describe('applyPresentFields / isPresentField (R1)', () => {
  // What the house ValidationPipe hands a service: every declared field is an own
  // property, a field left out holds undefined.
  const dto = { sent: 'x', cleared: null, leftOut: undefined };

  it('treats an own undefined as left out, and null as sent', () => {
    expect(isPresentField(dto, 'sent')).toBe(true);
    expect(isPresentField(dto, 'cleared')).toBe(true);
    expect(isPresentField(dto, 'leftOut')).toBe(false);
    expect(isPresentField(dto, 'absent')).toBe(false);
  });

  it('copies sent fields only, so a left-out field keeps what the target already holds', () => {
    const target: Record<string, unknown> = { leftOut: 'kept' };
    applyPresentFields(target, dto, ['sent', 'cleared', 'leftOut'], {
      leftOut: () => 'transform must not run',
      cleared: (value) => value ?? [],
    });
    expect(target).toEqual({ sent: 'x', cleared: [], leftOut: 'kept' });
  });
});

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
