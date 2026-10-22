import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SaleReturnExceptionFilter } from './sale-return-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/sale-returns/post', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

type ErrorBody = { message: string; errors: Array<{ field: string; code: string }> };

const bodyOf = (exception: unknown): ErrorBody => {
  const { host, json } = hostFor();
  new SaleReturnExceptionFilter().catch(exception, host);
  return json.mock.calls[0][0] as ErrorBody;
};

const fieldOf = (message: string): string =>
  bodyOf(new BadRequestException({ message: [message] })).errors[0].field;

describe('SaleReturnExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['srBillId must be a UUID', 'srBillId'],
    ['items.0.sriBucket must be one of SALEABLE, DAMAGED — omit it for SALEABLE', 'sriBucket'],
    ['charges.0.cdAmount must be a number', 'cdAmount'],
    ['tenders.1.tdAmount must be a number', 'tdAmount'],
    ['reason should not be empty', 'reason'],
    ['baseRevision must not be less than 1', 'baseRevision'],
    ['editRemark should not be empty', 'editRemark'],
    ['transport.lrNo must be a string', 'transport'],
    ['sdcCustId must be a UUID', 'request'],
    ['overrides must be an array', 'request'],
  ])('files "%s" under %s', (message, field) => {
    expect(fieldOf(message)).toBe(field);
  });

  it('answers a validation failure with a 400 in the house shape', () => {
    const { host, status, json } = hostFor();

    new SaleReturnExceptionFilter().catch(
      new BadRequestException({ message: 'srCustName should not be empty' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'srCustName',
          code: 'VALIDATION_FAILED',
          message: 'srCustName should not be empty',
        },
      ],
    });
  });

  it('codes a non-whitelisted property as VALIDATION_WHITELIST', () => {
    expect(
      bodyOf(new BadRequestException({ message: ['property srFoo should not exist'] })).errors,
    ).toEqual([expect.objectContaining({ field: 'srFoo', code: 'VALIDATION_WHITELIST' })]);
  });

  it('passes the 422 of a refused post through with every refusal', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Sale return cannot be posted',
      errors: [
        { field: 'srCustId', message: 'no customer', code: 'SALES_PAN_REQUIRED' },
        { field: 'tenders', message: 'short', code: 'SALES_AMOUNT_MISMATCH' },
      ],
    };

    new SaleReturnExceptionFilter().catch(new UnprocessableEntityException(body), host);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('codes a plain Nest exception by its status', () => {
    expect(bodyOf(new ForbiddenException('Not yours')).errors).toEqual([
      { field: 'request', code: 'HTTP_403', message: 'Not yours' },
    ]);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new SaleReturnExceptionFilter().catch(new TypeError('x is undefined'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', code: 'INTERNAL_ERROR' })],
      }),
    );
  });
});
