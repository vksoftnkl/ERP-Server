import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { StockErrorCode } from '../types/stock-error-codes';
import { SellingPriceBulkExceptionFilter } from './selling-price-bulk-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/stock/price-bulk', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

/** A RAISE from inside the engine, as Prisma hands it over: P2010 with the SQLSTATE in meta. */
const engineError = (meta: unknown) =>
  Object.assign(new Error('Raw query failed'), { code: 'P2010', meta });

describe('SellingPriceBulkExceptionFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  // ── the named constraints ─────────────────────────────────────────────────
  it.each([
    ['ex_ipm_overlap', '23P01', 409, StockErrorCode.PRICE_OVERLAP],
    ['ck_ipm_not_above_mrp', '23514', 422, StockErrorCode.PRICE_ABOVE_MRP],
    ['ck_ipm_bucket_mrp_is_max', '23514', 422, StockErrorCode.PRICE_BUCKET_MRP_MISMATCH],
    ['ck_ipm_bucket_mrp', '23514', 422, StockErrorCode.PRICE_BUCKET_MRP_ZERO],
    ['ck_ipm_bucket_sp', '23514', 422, StockErrorCode.PRICE_BUCKET_SP_ZERO],
    ['chk_ipm_nonnegative', '23514', 422, StockErrorCode.PRICE_NEGATIVE],
  ])('files %s under its own name and code', (constraint, sqlState, httpStatus, code) => {
    const { host, status, json } = hostFor();
    const engineMessage = `new row violates constraint "${constraint}"`;

    new SellingPriceBulkExceptionFilter().catch(
      engineError({ code: sqlState, message: engineMessage }),
      host,
    );

    expect(status).toHaveBeenCalledWith(httpStatus);
    const [body] = json.mock.calls[0] as [
      { message: string; errors: { field: string; code: string; message: string }[] },
    ];
    expect(body.errors).toEqual([
      expect.objectContaining({
        field: constraint,
        code,
        message: expect.stringContaining(engineMessage),
      }),
    ]);
    expect(body.message).not.toContain(constraint);
  });

  // ── an unnamed constraint ─────────────────────────────────────────────────
  it("passes the engine's own words on, under request, with the generic database code", () => {
    const { host, status, json } = hostFor();

    new SellingPriceBulkExceptionFilter().catch(
      engineError({ code: '23503', message: '  insert violates foreign key "fk_ipm_item"  ' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'insert violates foreign key "fk_ipm_item"',
        errors: [
          {
            field: 'request',
            code: StockErrorCode.DB_BAD_REFERENCE,
            message: 'insert violates foreign key "fk_ipm_item"',
          },
        ],
      }),
    );
  });

  it('says which SQLSTATE refused the price when the engine gave no words', () => {
    const { host, json } = hostFor();

    new SellingPriceBulkExceptionFilter().catch(
      engineError({ code: '23514', message: '   ' }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'The database refused this price (SQLSTATE 23514).',
        errors: [expect.objectContaining({ code: StockErrorCode.DB_CHECK_FAILED })],
      }),
    );
  });

  // ── what it will not dress up ─────────────────────────────────────────────
  it.each([
    ['an error with no meta', new Error('connection reset')],
    ['meta that is not an object', engineError('23514')],
    ['meta whose code is not text', engineError({ code: 23514 })],
    ['a thrown string', 'boom'],
    ['a thrown null', null],
  ])('answers %s with a coded 500', (_label, exception) => {
    const { host, status, json } = hostFor();

    new SellingPriceBulkExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });

  // ── validation messages ───────────────────────────────────────────────────
  it.each([
    ['scope must be one of the following values: BRANCH, CHAIN', 'scope'],
    ['rows.0.uomId must be a UUID', 'uomId'],
    ['ipmSalesPriceA must not be negative', 'ipmSalesPriceA'],
    ['companyId must be a UUID', 'request'],
  ])('files "%s" under %s', (message, field) => {
    const { host, json } = hostFor();

    new SellingPriceBulkExceptionFilter().catch(
      new BadRequestException({ message: [message] }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field, message })] }),
    );
  });
});
