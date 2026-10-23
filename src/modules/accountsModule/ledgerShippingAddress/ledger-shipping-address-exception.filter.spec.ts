import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { LedgerShippingAddressExceptionFilter } from './ledger-shipping-address-exception.filter';
import { LedgerShippingAddressErrorCode } from './types/ledger-shipping-address-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/ledger-shipping-addresses/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('LedgerShippingAddressExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['saaEmail must be an email', 'saaEmail'],
    ['property gstin should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new LedgerShippingAddressExceptionFilter().catch(
      new BadRequestException({ message: [message] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field, message })],
    });
  });

  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Ledger shipping address not found',
      errors: [
        { field: 'saaId', message: 'Not found', code: LedgerShippingAddressErrorCode.NOT_FOUND },
      ],
    };

    new LedgerShippingAddressExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new LedgerShippingAddressExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
