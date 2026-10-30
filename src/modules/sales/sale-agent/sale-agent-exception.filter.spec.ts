import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { SaleAgentExceptionFilter } from './sale-agent-exception.filter';
import { SaleAgentErrorCode } from './types/sale-agent-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/sale-agents/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('SaleAgentExceptionFilter', () => {
  let filter: SaleAgentExceptionFilter;

  beforeEach(() => {
    filter = new SaleAgentExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the sa field it names', () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: ['saGroupId must be a valid UUID'] }), host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'saGroupId',
          code: 'VALIDATION_FAILED',
          message: 'saGroupId must be a valid UUID',
        },
      ],
    });
  });

  it('files a message naming no agent field under request', () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: ['property extra should not exist'] }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', code: 'VALIDATION_WHITELIST' })],
      }),
    );
  });

  it('passes a coded agent refusal through unchanged', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Sale agent code already exists for this company',
      errors: [{ field: 'saCode', message: 'dup', code: SaleAgentErrorCode.CODE_EXISTS }],
    };

    filter.catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status } = hostFor();

    filter.catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
  });
});
