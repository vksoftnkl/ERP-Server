import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CityExceptionFilter } from './city-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/city', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('CityExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the field it names', () => {
    const { host, status, json } = hostFor();

    new CityExceptionFilter().catch(
      new BadRequestException({ message: ['ctmStateId must be a string'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        { field: 'ctmStateId', code: 'VALIDATION_FAILED', message: 'ctmStateId must be a string' },
      ],
    });
  });

  it("files another master's field under request", () => {
    const { host, json } = hostFor();

    new CityExceptionFilter().catch(
      new BadRequestException({ message: 'armCityId must be a string' }),
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
      message: 'Not found',
      errors: [{ field: 'ctmStateId', message: 'Not found', code: 'SOME_NOT_FOUND' }],
    };

    new CityExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new CityExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
