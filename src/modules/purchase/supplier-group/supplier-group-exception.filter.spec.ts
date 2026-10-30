import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { SupplierGroupExceptionFilter } from './supplier-group-exception.filter';
import { SupplierGroupErrorCode } from './types/supplier-group-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/supplier-groups/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('SupplierGroupExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the spg field it names', () => {
    const { host, status, json } = hostFor();

    new SupplierGroupExceptionFilter().catch(
      new BadRequestException({
        message: ['spgShort must be shorter than or equal to 50 characters'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        expect.objectContaining({
          field: 'spgShort',
          message: 'spgShort must be shorter than or equal to 50 characters',
        }),
      ],
    });
  });

  it('files a message naming no spg field under request', () => {
    const { host, json } = hostFor();

    new SupplierGroupExceptionFilter().catch(
      new BadRequestException({ message: ['property name should not exist'] }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Supplier group not found',
      errors: [
        {
          field: 'spgId',
          message: 'No active supplier group',
          code: SupplierGroupErrorCode.NOT_FOUND,
        },
      ],
    };

    new SupplierGroupExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new SupplierGroupExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
