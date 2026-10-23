import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { TenderTypeMasterExceptionFilter } from './tender-type-master-exception.filter';
import { TenderTypeErrorCode } from './types/tender-type-master-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/tender-type-masters/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('TenderTypeMasterExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the ttm field it names', () => {
    const { host, status, json } = hostFor();

    new TenderTypeMasterExceptionFilter().catch(
      new BadRequestException({ message: ['ttmTypeId must match /^\\d+$/ regular expression'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field: 'ttmTypeId' })],
    });
  });

  it('files a message naming no ttm field under request', () => {
    const { host, json } = hostFor();

    new TenderTypeMasterExceptionFilter().catch(
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
      message: 'Tender type not found',
      errors: [
        {
          field: 'ttmTypeId',
          message: 'No active tender type',
          code: TenderTypeErrorCode.NOT_FOUND,
        },
      ],
    };

    new TenderTypeMasterExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new TenderTypeMasterExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
