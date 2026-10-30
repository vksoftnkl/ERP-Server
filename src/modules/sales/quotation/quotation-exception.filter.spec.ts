import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QuotationExceptionFilter } from './quotation-exception.filter';
import { QuotationErrorCode } from './types/quotation-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/quotations/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

const fieldOf = (json: jest.Mock): string =>
  (json.mock.calls[0][0] as { errors: Array<{ field: string }> }).errors[0].field;

/**
 * A quotation body reaches three tables — the header (sq*), its lines (sqi*,
 * reported by class-validator as `items.0.sqiX`) and the applied charges (cd*,
 * `charges.0.cdX`) — and the filter files a ValidationPipe message under the
 * field of whichever it names.
 */
describe('QuotationExceptionFilter', () => {
  let filter: QuotationExceptionFilter;

  beforeEach(() => {
    filter = new QuotationExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('files a header message under its sq field', () => {
    const { host, status, json } = hostFor();

    filter.catch(new BadRequestException({ message: ['sqCustName should not be empty'] }), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'sqCustName',
          code: 'VALIDATION_FAILED',
          message: 'sqCustName should not be empty',
        },
      ],
    });
  });

  it.each([
    ['items.0.sqiItemId must be a UUID', 'sqiItemId'],
    ['charges.2.cdSlno must be an integer number', 'cdSlno'],
    ['txhCompanyId must be a UUID', 'request'],
    ['each value in nested property items must be an object', 'request'],
  ])('files %p under %p', (message, field) => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: [message] }), host);

    expect(fieldOf(json)).toBe(field);
  });

  it('keeps one error per message, in order', () => {
    const { host, json } = hostFor();

    filter.catch(
      new BadRequestException({
        message: ['sqAccYear must be a string', 'items.1.sqiQty must not be less than 0'],
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.objectContaining({ field: 'sqAccYear' }),
          expect.objectContaining({ field: 'sqiQty' }),
        ],
      }),
    );
  });

  it('passes a coded service refusal through untouched', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Quotation lookup requires an identifier',
      errors: [
        {
          field: 'sqId',
          message: 'Provide either sqId or sqQuoteNo',
          code: QuotationErrorCode.LOOKUP_KEY_REQUIRED,
        },
      ],
    };

    filter.catch(new BadRequestException(body), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    filter.catch(new NotFoundException('Cannot POST /v1/quotations/nope'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Cannot POST /v1/quotations/nope',
      errors: [{ field: 'request', code: 'HTTP_404', message: 'Cannot POST /v1/quotations/nope' }],
    });
  });

  it('falls back to the exception message when the response carries none', () => {
    const { host, json } = hostFor();

    filter.catch(new HttpException({ reason: 'teapot' }, HttpStatus.I_AM_A_TEAPOT), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ code: 'HTTP_418' })],
      }),
    );
  });

  it('answers a numeric overflow from an ORM write with a 422 carrying the detail', () => {
    const { host, status, json } = hostFor();
    const overflow = new Error(
      'Invalid `prisma.saleQuotation.create()` invocation: ... code: "22003", ' +
        'detail: Some("A field with precision 18, scale 4 must round to an absolute value less than 10^14.")',
    );

    filter.catch(overflow, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.objectContaining({
            code: 'VALUE_TOO_LARGE',
            message:
              'A value is too large to save: A field with precision 18, scale 4 must round to an ' +
              'absolute value less than 10^14.',
          }),
        ],
      }),
    );
  });

  it('answers anything else with a coded 500', () => {
    const { host, status, json } = hostFor();

    filter.catch('not even an Error', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
