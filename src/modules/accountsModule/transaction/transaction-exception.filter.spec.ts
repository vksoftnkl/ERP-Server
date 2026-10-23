import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { TransactionExceptionFilter } from './transaction-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'GET',
        url: '/v1/transactions/party-balance',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('TransactionExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['partyId must be a UUID', 'partyId'],
    ['companyId must be a UUID', 'companyId'],
    // The pattern names its two fields literally; type is not one of them.
    ['type must be one of the following values: CR, DR', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new TransactionExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field, message })],
    });
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new TransactionExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
