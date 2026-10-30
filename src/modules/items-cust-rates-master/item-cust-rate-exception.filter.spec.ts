import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ItemCustRateExceptionFilter } from './item-cust-rate-exception.filter';
import { ItemCustRateErrorCode } from './types/item-cust-rate-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/item-cust-rates/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('ItemCustRateExceptionFilter', () => {
  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Item customer rate already exists',
      errors: [{ field: 'csr_id', code: ItemCustRateErrorCode.DUPLICATE, message: 'Duplicate' }],
    };

    new ItemCustRateExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it.each([
    ['csr_price_level must be one of A, B, C, D', 'csr_price_level'],
    ['csr_valid_from must be a valid ISO 8601 date string', 'csr_valid_from'],
    ['property price should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new ItemCustRateExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field, message, code: expect.any(String) as string })],
    });
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    new ItemCustRateExceptionFilter().catch(new NotFoundException(), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', code: 'HTTP_404' })],
      }),
    );
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    new ItemCustRateExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
