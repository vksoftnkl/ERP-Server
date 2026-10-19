import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { CompanyMasterExceptionFilter } from './company-master-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/company-masters/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('CompanyMasterExceptionFilter', () => {
  const filter = new CompanyMasterExceptionFilter();

  beforeEach(() => {
    // The 500 branch logs the stack; keep the test output clean.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['compGstinNo must be longer than or equal to 15 characters', 'compGstinNo'],
    ['compDcPurposes must contain at least 1 elements', 'compDcPurposes'],
    ['brName must be a string', 'request'],
  ])('files "%s" under %s', (message, field) => {
    const { host, status, json } = hostFor();

    filter.catch(new BadRequestException({ message: [message] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field, message })],
    });
  });

  it('passes a house refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Company name already exists',
      errors: [{ field: 'compName', message: 'Duplicate', code: 'COMPANY_NAME_DUPLICATE' }],
    };

    filter.catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
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
