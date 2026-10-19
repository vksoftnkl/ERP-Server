import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CustomerExceptionFilter } from './customer-exception.filter';
import { CustomerErrorCode } from './types/customer-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/customers/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('CustomerExceptionFilter', () => {
  let filter: CustomerExceptionFilter;

  beforeEach(() => {
    filter = new CustomerExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the cus field it names', () => {
    const { host, status, json } = hostFor();

    filter.catch(
      new BadRequestException({ message: ['cusStateCode must be longer than or equal to 2'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'cusStateCode',
          code: 'VALIDATION_FAILED',
          message: 'cusStateCode must be longer than or equal to 2',
        },
      ],
    });
  });

  it('files a message naming no customer field under request', () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: 'saName must be a string' }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  it('passes a coded customer refusal through unchanged', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Customer not found',
      errors: [{ field: 'cusId', message: 'gone', code: CustomerErrorCode.NOT_FOUND }],
    };

    filter.catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    filter.catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
