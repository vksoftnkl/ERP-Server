import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { GST_CODES } from './config/gst-config.constants';
import { GstExceptionFilter } from './gst-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/gst/providers/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('GstExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files each validation message under the gst field it names', () => {
    const { host, status, json } = hostFor();

    new GstExceptionFilter().catch(
      new BadRequestException({
        message: [
          'gpvCode must start with a letter and hold only A-Z, 0-9 and _',
          'gpsBaseUrl must be http(s)://host, no trailing slash',
          'clientSecret must be a string',
          'each of clear must be one of: clientId, clientSecret, apiKey',
        ],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        expect.objectContaining({ field: 'gpvCode', code: 'VALIDATION_FAILED' }),
        expect.objectContaining({ field: 'gpsBaseUrl' }),
        expect.objectContaining({ field: 'clientSecret' }),
        expect.objectContaining({ field: 'clear' }),
      ],
    });
  });

  it('files a field of another module under request', () => {
    const { host, json } = hostFor();

    new GstExceptionFilter().catch(
      new BadRequestException({ message: 'ctmStateId must be a string' }),
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
      message: 'GST provider not found',
      errors: [
        { field: 'gpvId', message: 'No gst provider found with id x', code: GST_CODES.NOT_FOUND },
      ],
    };

    new GstExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new GstExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
