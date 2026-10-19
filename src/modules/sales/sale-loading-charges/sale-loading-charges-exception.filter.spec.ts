import { ArgumentsHost, BadRequestException, ConflictException } from '@nestjs/common';
import { SaleLoadingChargeExceptionFilter } from './sale-loading-charges-exception.filter';
import { SaleLoadingChargeErrorCode } from './types/sale-loading-charges-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/sale-loading-charges/create', headers: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('SaleLoadingChargeExceptionFilter', () => {
  it.each([
    ['ilcCompId must be a valid UUID', 'ilcCompId'],
    ['ilcUnloadChrg must be a number', 'ilcUnloadChrg'],
    ['frToKm must be a number', 'request'],
  ])('files "%s" under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new SaleLoadingChargeExceptionFilter().catch(new BadRequestException({ message }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field, code: 'VALIDATION_FAILED', message }],
    });
  });

  it('passes the slab overlap through as the service shaped it', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Overlapping sale loading charge slab',
      errors: [
        {
          field: 'ilcFromWeight',
          message: 'Weight range overlaps an existing slab for this company/branch.',
          code: SaleLoadingChargeErrorCode.RANGE_OVERLAPS,
        },
      ],
    };

    new SaleLoadingChargeExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });
});
