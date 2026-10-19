import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { StateExceptionFilter } from './state-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/state', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('StateExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the field it names', () => {
    const { host, status, json } = hostFor();

    new StateExceptionFilter().catch(
      new BadRequestException({ message: ['stmName must be a string'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        { field: 'stmName', code: 'VALIDATION_FAILED', message: 'stmName must be a string' },
      ],
    });
  });

  it("files another master's field under request", () => {
    const { host, json } = hostFor();

    new StateExceptionFilter().catch(
      new BadRequestException({ message: 'ctmName must be a string' }),
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
      errors: [{ field: 'stmName', message: 'Not found', code: 'SOME_NOT_FOUND' }],
    };

    new StateExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new StateExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
