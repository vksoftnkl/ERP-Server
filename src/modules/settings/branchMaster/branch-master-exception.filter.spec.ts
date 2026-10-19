import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { BranchMasterExceptionFilter } from './branch-master-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/branch-masters/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('BranchMasterExceptionFilter', () => {
  const filter = new BranchMasterExceptionFilter();

  beforeEach(() => {
    // The 500 branch logs the stack; keep the test output clean.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['brStateCode must be longer than or equal to 2 characters', 'brStateCode'],
    // The service names the company field compId, so the filter matches it too.
    ['compId must be a UUID', 'compId'],
    ['compName must be a string', 'request'],
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
      message: 'This branch is still in use',
      errors: [{ field: 'brId', message: 'Used by 3 sale bills', code: 'BRANCH_IN_USE' }],
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
