import { ArgumentsHost, BadRequestException, ConflictException } from '@nestjs/common';
import { SaleFreightChargeExceptionFilter } from './sale-freight-charges-exception.filter';
import { SaleFreightChargeErrorCode } from './types/sale-freight-charges-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/sale-freight-charges/create', headers: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('SaleFreightChargeExceptionFilter', () => {
  it.each([
    ['frCompanyId must be a valid UUID', 'frCompanyId'],
    ['frFreightChrg must be a number', 'frFreightChrg'],
    ['ilcLoadChrg must be a number', 'request'],
  ])('files "%s" under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new SaleFreightChargeExceptionFilter().catch(new BadRequestException({ message }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field, code: 'VALIDATION_FAILED', message }],
    });
  });

  it('passes the range clash through as the service shaped it', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Sale freight charge already exists',
      errors: [
        {
          field: 'frFromKm',
          message: 'Duplicate sale freight charge range is not allowed',
          code: SaleFreightChargeErrorCode.RANGE_EXISTS,
        },
      ],
    };

    new SaleFreightChargeExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });
});
