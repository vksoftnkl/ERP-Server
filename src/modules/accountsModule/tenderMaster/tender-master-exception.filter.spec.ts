import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { TenderMasterExceptionFilter } from './tender-master-exception.filter';
import { TenderMasterErrorCode } from './types/tender-master-api.types';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/tender-masters/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('TenderMasterExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['tndColour must be a hex colour (#RRGGBB or #RRGGBBAA)', 'tndColour'],
    ['property colour should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new TenderMasterExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

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
      message: 'A default tender already exists for this company and branch',
      errors: [
        { field: 'tndIsDefault', message: 'taken', code: TenderMasterErrorCode.DEFAULT_TAKEN },
      ],
    };

    new TenderMasterExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new TenderMasterExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
