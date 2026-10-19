import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { EmployeeMasterExceptionFilter } from './employee-master-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/settings', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('EmployeeMasterExceptionFilter', () => {
  const filter = new EmployeeMasterExceptionFilter();

  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the field it names', () => {
    const { host, status, json } = hostFor();

    filter.catch(new BadRequestException({ message: ['empSalaryType must be a string'] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'empSalaryType', code: 'VALIDATION_FAILED', message: 'empSalaryType must be a string' }],
    });
  });

  it("files another module's field under request", () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: 'edptName must be a string' }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  it('passes a house refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Not found',
      errors: [{ field: 'empSalaryType', message: 'Not found', code: 'SOME_NOT_FOUND' }],
    };

    filter.catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    filter.catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
