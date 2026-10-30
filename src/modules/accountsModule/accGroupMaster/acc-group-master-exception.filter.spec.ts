import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { AccGroupMasterExceptionFilter } from './acc-group-master-exception.filter';
import { AccGroupErrorCode } from './types/acc-group-master-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/account-groups/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('AccGroupMasterExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['accGroupParentId must be a UUID', 'accGroupParentId'],
    ['accGroupSort must be an integer number', 'accGroupSort'],
    ['property accLedgerProfile should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new AccGroupMasterExceptionFilter().catch(
      new BadRequestException({ message: [message] }),
      host,
    );

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
      message: 'Account group name already exists',
      errors: [{ field: 'accGroupName', message: 'Taken', code: AccGroupErrorCode.NAME_TAKEN }],
    };

    new AccGroupMasterExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new AccGroupMasterExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
