import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { TaxRateMasterExceptionFilter } from './tax-rate-master-exception.filter';
import { TaxRateErrorCode } from './types/tax-rate-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/tax-rates/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('TaxRateMasterExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a message under the header field or grid path it names', () => {
    const { host, status, json } = hostFor();

    new TaxRateMasterExceptionFilter().catch(
      new BadRequestException({
        message: [
          'tax_rate_perc must not be less than 0',
          'lines.0.trl_ledger_id must be a UUID',
          'trl_role must be shorter than or equal to 30 characters',
        ],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'tax_rate_perc',
          code: 'VALIDATION_FAILED',
          message: 'tax_rate_perc must not be less than 0',
        },
        {
          field: 'lines.0.trl_ledger_id',
          code: 'VALIDATION_FAILED',
          message: 'lines.0.trl_ledger_id must be a UUID',
        },
        {
          field: 'trl_role',
          code: 'VALIDATION_FAILED',
          message: 'trl_role must be shorter than or equal to 30 characters',
        },
      ],
    });
  });

  it("files another master's field under request", () => {
    const { host, json } = hostFor();

    new TaxRateMasterExceptionFilter().catch(
      new BadRequestException({ message: 'ith_tax_id must be a UUID' }),
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
      message: 'Tax rate not found',
      errors: [
        { field: 'tax_id', message: 'tax_id x was not found', code: TaxRateErrorCode.NOT_FOUND },
      ],
    };

    new TaxRateMasterExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new TaxRateMasterExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
