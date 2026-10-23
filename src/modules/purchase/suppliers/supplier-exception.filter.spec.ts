import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { SupplierExceptionFilter } from './supplier-exception.filter';
import { SupplierErrorCode } from './types/supplier-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/suppliers/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('SupplierExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['supStateCode must be longer than or equal to 2 characters', 'supStateCode'],
    ['property ledName should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new SupplierExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

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
      message: 'Supplier already exists',
      errors: [
        {
          field: 'supLinkLedId',
          message: 'already a supplier',
          code: SupplierErrorCode.LINK_LEDGER_ALREADY_SUPPLIER,
        },
      ],
    };

    new SupplierExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new SupplierExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
