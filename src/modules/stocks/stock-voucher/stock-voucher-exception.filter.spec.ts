import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { StockErrorCode } from '../types/stock-error-codes';
import { StockVoucherExceptionFilter } from './stock-voucher-exception.filter';

// The SQLSTATE → HTTP status table is pinned in stock-voucher.service.spec.ts.
// This file pins the rest: the notes-119 CODE on each translation, the engine's
// own wording, and every shape that must NOT be translated.

/** What Prisma hands back when a PL/pgSQL function RAISEs inside a raw query. */
const engineError = (meta: unknown) =>
  Object.assign(new Error('Raw query failed'), { code: 'P2010', meta });

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/stock/opening/post', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('StockVoucherExceptionFilter', () => {
  let filter: StockVoucherExceptionFilter;

  beforeEach(() => {
    filter = new StockVoucherExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['P0002', 404, StockErrorCode.DB_NOT_FOUND],
    ['23001', 409, StockErrorCode.DB_RESTRICTED],
    ['23505', 409, StockErrorCode.DB_DUPLICATE],
    ['23P01', 409, StockErrorCode.DB_OVERLAP],
    ['23514', 422, StockErrorCode.DB_CHECK_FAILED],
    ['23502', 422, StockErrorCode.DB_VALUE_MISSING],
    ['23503', 422, StockErrorCode.DB_BAD_REFERENCE],
    ['0A000', 409, StockErrorCode.DB_NOT_SUPPORTED],
  ])('codes SQLSTATE %s as %i %s, under field request', (sqlState, httpStatus, code) => {
    const { host, status, json } = hostFor();

    filter.catch(engineError({ code: sqlState, message: 'the engine said no' }), host);

    expect(status).toHaveBeenCalledWith(httpStatus);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'the engine said no',
      errors: [{ field: 'request', code, message: 'the engine said no' }],
    });
  });

  it('codes the negative-stock refusal STOCK_NEGATIVE_BLOCKED, whatever the case of its words', () => {
    const { host, status, json } = hostFor();

    filter.catch(
      engineError({ code: '23514', message: 'Stock for SALT in MAIN WOULD GO NEGATIVE' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ code: StockErrorCode.NEGATIVE_BLOCKED })],
      }),
    );
  });

  it('trims the engine message and names the SQLSTATE when the engine gave no words', () => {
    const trimmed = hostFor();
    const blank = hostFor();
    const absent = hostFor();

    filter.catch(engineError({ code: '23505', message: '  duplicate refno  ' }), trimmed.host);
    filter.catch(engineError({ code: '23505', message: '   ' }), blank.host);
    filter.catch(engineError({ code: '23505' }), absent.host);

    expect(trimmed.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'duplicate refno' }),
    );
    const fallback = 'The stock engine refused this document (SQLSTATE 23505).';
    expect(blank.json).toHaveBeenCalledWith(expect.objectContaining({ message: fallback }));
    expect(absent.json).toHaveBeenCalledWith(expect.objectContaining({ message: fallback }));
  });

  // Every one of these must keep falling through to the 500 path, stack and
  // all — dressed up as a clean 4xx, the client would retry it for ever.
  it.each([
    ['an error with no meta', new Error('connection reset')],
    ['an error whose meta is null', Object.assign(new Error('x'), { meta: null })],
    ['an error whose meta is not an object', Object.assign(new Error('x'), { meta: 'P2010' })],
    ['a meta with no SQLSTATE', engineError({ message: 'no code here' })],
    ['a meta whose SQLSTATE is not text', engineError({ code: 23505, message: 'x' })],
    ['a thrown string', 'boom'],
    ['a thrown null', null],
  ])('does not translate %s', (_label, exception) => {
    const { host, status, json } = hostFor();

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });

  it.each([
    ['lines.3.sviBatchNo must be shorter than or equal to 100 characters', 'sviBatchNo'],
    ['header.accYear must look like 2026-2027', 'accYear'],
    ['header.toGodownId must be a UUID', 'toGodownId'],
    ['deviceId must be a UUID', 'deviceId'],
    ['voucherType must be one of OPENING', 'voucherType'],
    ['svhId must be a UUID', 'svhId'],
    ['property gstNo should not exist', 'request'],
  ])('files the validation message "%s" under %s', (message, field) => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: [message] }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field, message })] }),
    );
  });
});
