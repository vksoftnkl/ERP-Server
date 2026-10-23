import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CompanyGroupMasterExceptionFilter } from './company-group-master-exception.filter';
import { CompanyGroupErrorCode } from './types/company-group-master-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/company-group-masters/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('CompanyGroupMasterExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the cog field it names', () => {
    const { host, status, json } = hostFor();

    new CompanyGroupMasterExceptionFilter().catch(
      new BadRequestException({ message: ['each value in cogCompanyIds must be a UUID'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        expect.objectContaining({
          field: 'cogCompanyIds',
          message: 'each value in cogCompanyIds must be a UUID',
        }),
      ],
    });
  });

  it('files a message naming no cog field under request', () => {
    const { host, json } = hostFor();

    new CompanyGroupMasterExceptionFilter().catch(
      new BadRequestException({ message: ['property groupName should not exist'] }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  it.each([
    [
      'a not-found refusal',
      new NotFoundException({
        success: false,
        message: 'Company group not found',
        errors: [
          {
            field: 'cogGroupId',
            message: 'No active company group found',
            code: CompanyGroupErrorCode.NOT_FOUND,
          },
        ],
      }),
      404,
    ],
    [
      'a name-taken refusal',
      new ConflictException({
        success: false,
        message: 'Company group name already exists',
        errors: [
          {
            field: 'cogGroupName',
            message: 'Duplicate cogGroupName is not allowed',
            code: CompanyGroupErrorCode.NAME_TAKEN,
          },
        ],
      }),
      409,
    ],
  ])('passes %s through with its own status and code', (_label, exception, statusCode) => {
    const { host, status, json } = hostFor();

    new CompanyGroupMasterExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(statusCode);
    expect(json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    new CompanyGroupMasterExceptionFilter().catch(new NotFoundException(), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors: [expect.objectContaining({ field: 'request', code: 'HTTP_404' })],
      }),
    );
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new CompanyGroupMasterExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
